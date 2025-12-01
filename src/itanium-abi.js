/**
 * Demangles C++ function names mangled according to the IA64 C++ ABI
 *
 * This means that this file demangles function names mangled by GCC and Clang.
 *
 * Material used: https://itanium-cxx-abi.github.io/cxx-abi/abi.html#mangling
 */

module.exports = {
	isMangled: (name) => name.startsWith("_Z"),

	demangle: function (name) {
		if (!this.isMangled(name)) return name;

		const dotIndex = name.indexOf('.');
		const encoding = dotIndex < 0 ? name.slice(2) : name.slice(2, dotIndex);

		const { name: functionName, str: afterName, isConst = false } = parseEncodedName(encoding);
		const { templateParams, str: afterTemplate } = parseTemplatePlaceholders(afterName);

		const substitutions = buildSubstitutions(functionName, templateParams);
		let remaining = skipReturnTypeIfNeeded(afterTemplate, templateParams, substitutions);

		const { types } = parseTypeList(remaining, substitutions, templateParams);
		const parameterList = TypeFormatter.serializeTypeList(types);

		return `${functionName}(${parameterList})${isConst ? ' const' : ''}`;
	}
};

function buildSubstitutions(functionName, templateParams) {
	const substitutions = [];
	if (functionName.includes('::')) {
		const lastColonIndex = functionName.lastIndexOf('::');
		substitutions.push(functionName.substring(0, lastColonIndex));
	}
	const visitor = new FormatVisitor();
	for (const param of templateParams) {
		substitutions.push(param.accept(visitor));
	}
	return substitutions;
}

function skipReturnTypeIfNeeded(remaining, templateParams, substitutions) {
	if (templateParams.length > 0 && remaining.length > 0) {
		const result = parseTypeHelper(remaining, substitutions, templateParams);
		return result.remaining;
	}
	return remaining;
}

function parseLengthPrefixed(str) {
	const lengthMatch = /(\d+)/.exec(str);
	if (!lengthMatch || !lengthMatch[0]) {
		return { value: "", remaining: str };
	}

	const length = parseInt(lengthMatch[0], 10);
	const afterLength = str.slice(lengthMatch[0].length);
	const value = afterLength.slice(0, length);
	const remaining = afterLength.slice(length);

	return { value, remaining };
}

function getOperatorName(code) {
	const operatorMap = {
		'nw': 'operator new',
		'na': 'operator new[]',
		'dl': 'operator delete',
		'da': 'operator delete[]',
		'ps': 'operator+', // unary
		'ng': 'operator-', // unary
		'ad': 'operator&', // unary
		'de': 'operator*', // unary
		'co': 'operator~',
		'pl': 'operator+',
		'mi': 'operator-',
		'ml': 'operator*',
		'dv': 'operator/',
		'rm': 'operator%',
		'an': 'operator&',
		'or': 'operator|',
		'eo': 'operator^',
		'aS': 'operator=',
		'pL': 'operator+=',
		'mI': 'operator-=',
		'mL': 'operator*=',
		'dV': 'operator/=',
		'rM': 'operator%=',
		'aN': 'operator&=',
		'oR': 'operator|=',
		'eO': 'operator^=',
		'ls': 'operator<<',
		'rs': 'operator>>',
		'lS': 'operator<<=',
		'rS': 'operator>>=',
		'eq': 'operator==',
		'ne': 'operator!=',
		'lt': 'operator<',
		'gt': 'operator>',
		'le': 'operator<=',
		'ge': 'operator>=',
		'ss': 'operator<=>',
		'nt': 'operator!',
		'aa': 'operator&&',
		'oo': 'operator||',
		'pp': 'operator++',
		'mm': 'operator--',
		'cm': 'operator,',
		'pm': 'operator->*',
		'pt': 'operator->',
		'cl': 'operator()',
		'ix': 'operator[]',
		'qu': 'operator?',
		'cv': 'operator', // cast (type follows)
		'li': 'operator""' // literal operator
	};

	return operatorMap[code] || null;
}

// Strategy-based parsing for individual name segments (namespaces, classes, ctors, dtors, operators)
const SEGMENT_PARSERS = [
	{
		matches: (str) => /^C[123]/.test(str),
		parse: (str, ctx) => ({ segment: ctx.className, remaining: str.slice(2) })
	},
	{
		matches: (str) => /^D[012]/.test(str),
		parse: (str, ctx) => ({ segment: '~' + ctx.className, remaining: str.slice(2) })
	},
	{
		matches: (str) => /^[a-z][a-zA-Z]/.test(str) && getOperatorName(str.slice(0, 2)),
		parse: (str) => ({ segment: getOperatorName(str.slice(0, 2)), remaining: str.slice(2) })
	},
	{
		matches: () => true,
		parse: (str) => {
			const { value, remaining } = parseLengthPrefixed(str);
			const segment = value === '_GLOBAL__N_1' ? '(anonymous namespace)' : value;
			return { segment, remaining };
		}
	}
];

function parseNameSegment(str, className = '') {
	for (const parser of SEGMENT_PARSERS) {
		if (parser.matches(str)) {
			return { ...parser.parse(str, { className }) };
		}
	}
}

const isValidSegmentStart = (char) => /[\da-zCD]/.test(char);
const isNamespaceTerminator = (char) => char === 'E' || char === 'I';

function getCurrentClassName(segments) {
	return segments.length > 0 ? segments[segments.length - 1].replace(/^operator.*/, '').trim() : '';
}

function parseConstQualifier(str) {
	return str[0] === 'K'
		? { isConst: true, remaining: str.slice(1) }
		: { isConst: false, remaining: str };
}

function parseStdPrefix(originalStr, remaining) {
	return originalStr.slice(1, 3) === "St"
		? { segments: ["std"], remaining: remaining.replace("St", "") }
		: { segments: [], remaining };
}

function parseSegmentWithTemplate(remaining, className) {
	const { segment, remaining: afterSegment } = parseNameSegment(remaining, className);
	if (!segment) return { segment: null, remaining };
	
	const { args, str } = parseTemplateArgs(afterSegment, []);
	if (!args) return { segment, remaining: afterSegment };
	
	const templateType = new TemplateType(segment, args);
	const visitor = new FormatVisitor();
	return { segment: templateType.accept(visitor), remaining: str };
}

function parseNamespaceSegments(remaining, initialSegments = []) {
	const segments = [...initialSegments];

	while (remaining.length > 0) {
		if (isNamespaceTerminator(remaining[0]) || !isValidSegmentStart(remaining[0])) break;

		const className = getCurrentClassName(segments);
		const { segment, remaining: newRemaining } = parseSegmentWithTemplate(remaining, className);
		if (!segment) break;

		segments.push(segment);
		remaining = newRemaining;
	}

	return { segments, remaining };
}

function parseEncodedName(str) {
	if (str[0] !== 'N') {
		const { segment, remaining } = parseNameSegment(str);
		if (!segment) return { name: '', str, isConst: false };
		
		const { args, str: after } = parseTemplateArgs(remaining, []);
		if (args && args.length > 0 && /\d/.test(remaining[1])) {
			const templateType = new TemplateType(segment, args);
			const visitor = new FormatVisitor();
			return { name: templateType.accept(visitor), str: after, isConst: false };
		}
		
		return { name: segment, str: remaining, isConst: false };
	}
	
	let remaining = str.slice(1);
	const { isConst, remaining: afterConst } = parseConstQualifier(remaining);
	const { segments: stdSegments, remaining: afterStd } = parseStdPrefix(str, afterConst);
	const { segments, remaining: afterSegments } = parseNamespaceSegments(afterStd, stdSegments);
	const finalRemaining = afterSegments[0] === 'E' ? afterSegments.slice(1) : afterSegments;
	return { name: segments.join('::'), str: finalRemaining, isConst };
}

function parseTemplateArgs(str, substitutions = []) {
	if (str[0] !== 'I') return { args: null, str };
	
	const isLengthPrefixed = str[1] && /\d/.test(str[1]);
	let remaining = str.slice(1);
	const args = [];
	
	if (isLengthPrefixed) {
		while (remaining.length > 0 && remaining[0] !== 'E') {
			const { value, remaining: after } = parseLengthPrefixed(remaining);
			if (!value) break;
			args.push(new NamedType(value));
			remaining = after;
		}
	} else {
		const tempSubs = [...substitutions];
		while (remaining.length > 0 && remaining[0] !== 'E') {
			const { typeNode, remaining: after } = parseTypeHelper(remaining, tempSubs, []);
			if (!typeNode) break;
			args.push(typeNode);
			remaining = after;
		}
	}
	
	if (remaining[0] === 'E') remaining = remaining.slice(1);
	return { args, str: remaining };
}

/**
 * Helper function to parse a single type
 * Wraps parseSingleType with default parameters
 * Returns {typeNode, remaining} for use in other parsers
 */
const parseTypeHelper = (str, substitutions = [], templateParams = []) => {
	const result = parseSingleType(str, [], 0, [], substitutions, templateParams);
	return {
		typeNode: result.typeNode,
		parseNode: result.parseNode,
		remaining: result.remaining
	};
}

function parseArrayType(str, substitutions = [], templateParams = []) {
	const sizeMatch = /^(\d+)_/.exec(str);
	if (!sizeMatch) return { typeNode: null, str };

	const { typeNode: innerType, remaining } = parseTypeHelper(str.slice(sizeMatch[0].length), substitutions, templateParams);
	if (!innerType) return { typeNode: null, str };

	// Extract dimensions from nested arrays
	const dimensions = [sizeMatch[1]];
	let elementType = innerType;

	// If the inner type is already an ArrayType, flatten the dimensions
	if (innerType instanceof ArrayType) {
		dimensions.push(...innerType.dimensions);
		elementType = innerType.elementType;
	}

	const typeNode = new ArrayType(elementType, dimensions);
	return { typeNode, str: remaining };
}

function parseFunctionSignature(str, substitutions = [], templateParams = []) {
	const { typeNode: returnType, remaining: afterReturn } = parseTypeHelper(str, substitutions, templateParams);
	if (!returnType) return { returnType: null, params: [], remaining: str };

	const params = [];
	let remaining = afterReturn;

	while (remaining.length > 0 && remaining[0] !== 'E') {
		const { typeNode, remaining: afterParam } = parseTypeHelper(remaining, substitutions, templateParams);
		if (typeNode) params.push(typeNode);
		remaining = afterParam;
	}

	return { returnType, params, remaining: remaining[0] === 'E' ? remaining.slice(1) : remaining };
}

class TypeVisitor {
	visitBasicType(node) { throw new Error('visitBasicType not implemented'); }
	visitNamedType(node) { throw new Error('visitNamedType not implemented'); }
	visitQualifiedType(node) { throw new Error('visitQualifiedType not implemented'); }
	visitPointerType(node) { throw new Error('visitPointerType not implemented'); }
	visitReferenceType(node) { throw new Error('visitReferenceType not implemented'); }
	visitArrayType(node) { throw new Error('visitArrayType not implemented'); }
	visitFunctionPointerType(node) { throw new Error('visitFunctionPointerType not implemented'); }
	visitMemberFunctionPointerType(node) { throw new Error('visitMemberFunctionPointerType not implemented'); }
	visitTemplateType(node) { throw new Error('visitTemplateType not implemented'); }
}

class FormatVisitor extends TypeVisitor {
	visitBasicType(node) {
		return node.name;
	}

	visitNamedType(node) {
		return node.name;
	}

	visitQualifiedType(node) {
		let result = '';
		if (node.isConst) result += 'const ';
		if (node.isVolatile) result += 'volatile ';
		result += node.baseType.accept(this);
		if (node.isRestrict) result += ' restrict';
		return result;
	}

	visitPointerType(node) {
		return node.pointeeType.accept(this) + '*'.repeat(node.count);
	}

	visitReferenceType(node) {
		return node.referencedType.accept(this) + (node.isRValue ? '&&' : '&');
	}

	visitArrayType(node) {
		const baseFormat = node.elementType.accept(this);
		const dimensionsStr = node.dimensions.map(dim => `[${dim}]`).join('');
		return baseFormat + dimensionsStr;
	}

	visitFunctionPointerType(node) {
		const formattedParams = node.paramTypes.map(p => p.accept(this));
		const params = this._formatParamList(formattedParams);
		const returnTypeStr = node.returnType.accept(this);
		return `${returnTypeStr} (*)(${params})`;
	}

	visitMemberFunctionPointerType(node) {
		const formattedParams = node.paramTypes.map(p => p.accept(this));
		const params = this._formatParamList(formattedParams);
		const returnTypeStr = node.returnType.accept(this);
		const classTypeStr = node.classType.accept(this);
		const constQualifier = node.isConst ? ' const' : '';
		return `${returnTypeStr} (${classTypeStr}::*)(${params})${constQualifier}`;
	}

	visitTemplateType(node) {
		if (node.templateArgs.length === 0) {
			return node.baseName;
		}
		const args = node.templateArgs.map(arg => arg.accept(this)).join(', ');
		return `${node.baseName}<${args}>`;
	}

	_formatParamList(params) {
		if (params.length === 0) return '';
		if (params.length === 1 && params[0] === 'void') return '';
		return params.join(', ');
	}
}

class TypeFormatter {
	static formatParameterList(params) {
		if (params.length === 0) return '';
		if (params.length === 1 && params[0] === 'void') return '';
		return params.join(', ');
	}

	static formatType(type) {
		if (!type) return '';
		if (typeof type === 'string') return type;
		return type.accept(new FormatVisitor());
	}

	static formatTypeList(types) {
		return types.map(t => this.formatType(t));
	}
}

function parseFunctionType(str, substitutions = [], templateParams = []) {
	const { returnType, params, remaining } = parseFunctionSignature(str, substitutions, templateParams);
	if (!returnType) return { typeNode: null, str };

	const typeNode = new FunctionPointerType(returnType, params);
	return { typeNode, str: remaining };
}

function parseMemberFunctionPointer(str, substitutions = [], templateParams = []) {
	const { typeNode: classType, remaining: afterClass } = parseTypeHelper(str, substitutions, templateParams);
	if (!classType) return { typeNode: null, str };

	let remaining = afterClass;
	const isConst = remaining[0] === 'K';
	if (isConst) remaining = remaining.slice(1);

	if (remaining[0] !== 'F') return { typeNode: null, str };

	const { returnType, params, remaining: afterSignature } = parseFunctionSignature(remaining.slice(1), substitutions, templateParams);
	if (!returnType) return { typeNode: null, str };

	const typeNode = new MemberFunctionPointerType(classType, returnType, params, isConst);
	return { typeNode, str: afterSignature };
}

function parseTemplateParam(str, templateParams = []) {
	if (str[0] === '_') {
		const typeNode = templateParams.length > 0 ? templateParams[0] : null;
		return { typeNode, str: str.slice(1) };
	}

	const match = /^(\d+)_/.exec(str);
	if (match) {
		const index = parseInt(match[1], 10);
		const typeNode = index < templateParams.length ? templateParams[index] : null;
		return { typeNode, str: str.slice(match[0].length) };
	}

	return { typeNode: null, str };
}

function parseStdType(str, substitutions = []) {
	const stdTypeMap = {
		a: 'std::allocator',
		b: 'std::basic_string',
		s: 'std::basic_string<char, std::char_traits<char>, std::allocator<char>>',
		i: 'std::basic_istream<char, std::char_traits<char>>',
		o: 'std::basic_ostream<char, std::char_traits<char>>',
		d: 'std::basic_iostream<char, std::char_traits<char>>'
	};

	if (str[0] === '_') {
		const typeStr = substitutions[0] || '';
		const typeNode = typeStr ? new NamedType(typeStr) : null;
		return { typeNode, str: str.slice(1) };
	}

	const subMatch = /^(\d+)_/.exec(str);
	if (subMatch) {
		const index = parseInt(subMatch[1], 10);
		const typeStr = substitutions[index] || '';
		const typeNode = typeStr ? new NamedType(typeStr) : null;
		return { typeNode, str: str.slice(subMatch[0].length) };
	}

	if (str[0] === 't') {
		const { name, str: remaining } = parseEncodedName(str.slice(1));
		const typeNode = new NamedType(`std::${name}`);
		return { typeNode, str: remaining };
	}

	if (stdTypeMap[str[0]]) {
		const typeNode = new NamedType(stdTypeMap[str[0]]);
		return { typeNode, str: str.slice(1) };
	}

	if (!isNaN(parseInt(str[0], 10))) {
		const { name, str: remaining } = parseEncodedName(str);
		const typeNode = new NamedType(`std::${name}`);
		return { typeNode, str: remaining };
	}

	return { typeNode: null, str };
}

function parseTemplatePlaceholders(str) {
	if (str[0] !== 'I') return { templateParams: [], str };

	const templateParams = [];
	let remaining = str.slice(1);

	while (remaining.length > 0 && remaining[0] !== 'E') {
		const { typeNode, remaining: newRemaining } = parseTypeHelper(remaining, [], []);
		if (typeNode) templateParams.push(typeNode);
		remaining = newRemaining;
	}

	return { templateParams, str: remaining[0] === 'E' ? remaining.slice(1) : remaining };
}

function parseTypeList(encoding, substitutions = [], templateParams = []) {
	const types = [];
	let remaining = encoding;
	let templateDepth = 0;
	let templateStack = [];

	while (remaining.length > 0) {
		const result = parseSingleType(remaining, types, templateDepth, templateStack, substitutions, templateParams);

		if (result.parseNode) {
			types.push(result.parseNode);
			if (!result.parseNode.templateStart && !result.parseNode.templateEnd && result.parseNode.typeNode) {
				substitutions.push(result.parseNode.toString());
			}
		}

		remaining = result.remaining;
		templateDepth = result.templateDepth;
		templateStack = result.templateStack;
	}

	return { types };
}

class TypeNode {
	accept(visitor) {
		throw new Error('accept() must be implemented by subclass');
	}
}

class BasicType extends TypeNode {
	constructor(name) {
		super();
		this.name = name;
	}

	accept(visitor) {
		return visitor.visitBasicType(this);
	}
}

class NamedType extends TypeNode {
	constructor(name) {
		super();
		this.name = name;
	}

	accept(visitor) {
		return visitor.visitNamedType(this);
	}
}

class QualifiedType extends TypeNode {
	constructor(baseType, qualifiers = {}) {
		super();
		this.baseType = baseType;
		this.isConst = qualifiers.isConst || false;
		this.isVolatile = qualifiers.isVolatile || false;
		this.isRestrict = qualifiers.isRestrict || false;
	}

	accept(visitor) {
		return visitor.visitQualifiedType(this);
	}
}

class PointerType extends TypeNode {
	constructor(pointeeType, count = 1) {
		super();
		this.pointeeType = pointeeType;
		this.count = count;
	}

	accept(visitor) {
		return visitor.visitPointerType(this);
	}
}

class ReferenceType extends TypeNode {
	constructor(referencedType, isRValue = false) {
		super();
		this.referencedType = referencedType;
		this.isRValue = isRValue;
	}

	accept(visitor) {
		return visitor.visitReferenceType(this);
	}
}

class ArrayType extends TypeNode {
	constructor(elementType, dimensions = []) {
		super();
		this.elementType = elementType;
		this.dimensions = dimensions;
	}

	accept(visitor) {
		return visitor.visitArrayType(this);
	}
}

class FunctionPointerType extends TypeNode {
	constructor(returnType, paramTypes = []) {
		super();
		this.returnType = returnType;
		this.paramTypes = paramTypes;
	}

	accept(visitor) {
		return visitor.visitFunctionPointerType(this);
	}
}

class MemberFunctionPointerType extends TypeNode {
	constructor(classType, returnType, paramTypes = [], isConst = false) {
		super();
		this.classType = classType;
		this.returnType = returnType;
		this.paramTypes = paramTypes;
		this.isConst = isConst;
	}

	accept(visitor) {
		return visitor.visitMemberFunctionPointerType(this);
	}
}

class TemplateType extends TypeNode {
	constructor(baseName, templateArgs = []) {
		super();
		this.baseName = baseName;
		this.templateArgs = templateArgs;
	}

	accept(visitor) {
		return visitor.visitTemplateType(this);
	}
}

class ParseResult {
	constructor(parseNode, remaining, templateDepth, templateStack) {
		this.parseNode = parseNode;
		this.typeNode = parseNode ? parseNode.typeNode : null;
		this.remaining = remaining;
		this.templateDepth = templateDepth;
		this.templateStack = templateStack;
	}
}

const TYPE_PARSERS = [
	{
		matches: (char) => char === 'I',
		parse: (ctx) => {
			const lastType = ctx.types[ctx.types.length - 1];
			if (lastType) {
				lastType.templateStart = true;
				ctx.templateStack.push(lastType);
			}
			return new ParseResult(null, ctx.remaining, ctx.templateDepth + 1, ctx.templateStack);
		},
		isTemplateMarker: true
	},
	{
		matches: (char) => char === 'E',
		parse: (ctx) => {
			if (ctx.templateDepth <= 0) {
				return new ParseResult(null, ctx.remaining, ctx.templateDepth, ctx.templateStack);
			}
			const wrapper = new TypeParseNode(null);
			wrapper.templateEnd = true;
			const newDepth = ctx.templateDepth - 1;
			wrapper.templateType = ctx.templateStack[newDepth];
			return new ParseResult(wrapper, ctx.remaining, newDepth, ctx.templateStack.slice(0, -1));
		},
		isTemplateMarker: true
	},
	{
		basicTypes: {
			'v': 'void',
			'w': 'wchar_t',
			'b': 'bool',
			'c': 'char',
			'a': 'signed char',
			'h': 'unsigned char',
			's': 'short',
			't': 'unsigned short',
			'i': 'int',
			'j': 'unsigned int',
			'l': 'long',
			'm': 'unsigned long',
			'x': 'long long',
			'y': 'unsigned long long',
			'n': '__int128',
			'o': 'unsigned __int128',
			'f': 'float',
			'd': 'double',
			'e': 'long double',
			'g': '__float128',
			'z': '...'
		},
		matches: function (char) {
			return this.basicTypes[char] !== undefined;
		},
		parse: function (ctx) {
			const typeName = this.basicTypes[ctx.char];
			ctx.typeNode = new BasicType(typeName);
			return ctx.remaining;
		}
	},
	{
		matches: (char) => char === 'A',
		parse: (ctx) => {
			const result = parseArrayType(ctx.remaining, ctx.substitutions, ctx.templateParams);
			if (result.typeNode) {
				ctx.typeNode = result.typeNode;
				return result.str;
			}
			return null;
		}
	},
	{
		matches: (char, qualifiers) => char === 'F' && qualifiers.numPtr > 0,
		parse: (ctx) => {
			const result = parseFunctionType(ctx.remaining, ctx.substitutions, ctx.templateParams);
			if (result.typeNode) {
				ctx.typeNode = result.typeNode;
				ctx.qualifiers.numPtr = 0;  // Function pointer notation already includes the pointer
				return result.str;
			}
			return null;
		}
	},
	{
		matches: (char) => char === 'M',
		parse: (ctx) => {
			const result = parseMemberFunctionPointer(ctx.remaining, ctx.substitutions, ctx.templateParams);
			if (result.typeNode) {
				ctx.typeNode = result.typeNode;
				return result.str;
			}
			return null;
		}
	},
	{
		matches: (char) => char === 'T',
		parse: (ctx) => {
			const result = parseTemplateParam(ctx.remaining, ctx.templateParams);
			if (result.typeNode) {
				ctx.typeNode = result.typeNode;
				return result.str;
			}
			return null;
		}
	},
	{
		matches: (char) => char === 'S',
		parse: (ctx) => {
			const result = parseStdType(ctx.remaining, ctx.substitutions);
			if (!result.typeNode) return null;
			
			const { args, str } = parseTemplateArgs(result.str, ctx.substitutions);
			if (args && args.length > 0) {
				const visitor = new FormatVisitor();
				const baseName = result.typeNode.accept(visitor);
				ctx.typeNode = new TemplateType(baseName, args);
			} else {
				ctx.typeNode = result.typeNode;
			}
			
			return str;
		}
	},
	{
		matches: (char) => !isNaN(parseInt(char, 10)) || char === 'N',
		parse: (ctx) => {
			const { name, str } = parseEncodedName(ctx.char + ctx.remaining);
			ctx.typeNode = new NamedType(name);
			ctx.substitutions.push(name);
			return str;
		}
	}
];

/**
 * Parses type qualifiers (const, volatile, restrict, pointers, references)
 * Returns the parsed qualifiers and remaining string
 * This is pure parsing - no formatting logic
 */
function parseQualifiers(str) {
	const qualifiers = {
		isRef: false,
		isRValueRef: false,
		isRestrict: false,
		isVolatile: false,
		isConst: false,
		numPtr: 0
	};

	let remaining = str;
	const qualifierActions = {
		R: () => qualifiers.isRef = true,
		O: () => qualifiers.isRValueRef = true,
		r: () => qualifiers.isRestrict = true,
		V: () => qualifiers.isVolatile = true,
		K: () => qualifiers.isConst = true,
		P: () => qualifiers.numPtr++
	};

	while (qualifierActions[remaining[0]]) {
		qualifierActions[remaining[0]]();
		remaining = remaining.slice(1);
	}

	return { qualifiers, remaining };
}

/**
 * Wraps a type node with qualifiers (const, volatile, pointers, references)
 */
function applyQualifiers(baseType, qualifiers) {
	let result = baseType;

	// Apply const/volatile wrapping (but not restrict yet - it goes after pointers)
	if (qualifiers.isConst || qualifiers.isVolatile) {
		result = new QualifiedType(result, {
			isConst: qualifiers.isConst,
			isVolatile: qualifiers.isVolatile,
			isRestrict: false
		});
	}

	// Apply pointer wrapping
	if (qualifiers.numPtr > 0) {
		result = new PointerType(result, qualifiers.numPtr);
	}

	// Apply restrict after pointers
	if (qualifiers.isRestrict) {
		result = new QualifiedType(result, {
			isConst: false,
			isVolatile: false,
			isRestrict: true
		});
	}

	// Apply reference wrapping
	if (qualifiers.isRef) {
		result = new ReferenceType(result, false);
	} else if (qualifiers.isRValueRef) {
		result = new ReferenceType(result, true);
	}

	return result;
}

/**
 * Wrapper class to track template markers during parsing
 * Used to maintain template start/end markers for proper serialization
 */
class TypeParseNode {
	constructor(typeNode) {
		this.typeNode = typeNode;
		this.templateStart = false;
		this.templateEnd = false;
		this.templateType = null;
	}

	toString() {
		const visitor = new FormatVisitor();
		let result = this.typeNode ? this.typeNode.accept(visitor) : '';
		if (this.templateStart) result += '<';
		if (this.templateEnd) result += '>';
		return result;
	}

	isQualified() {
		return this.typeNode instanceof QualifiedType ||
			this.typeNode instanceof PointerType ||
			this.typeNode instanceof ReferenceType;
	}
}

function parseSingleType(encoding, types, templateDepth, templateStack, substitutions = [], templateParams = []) {
	const { qualifiers, remaining } = parseQualifiers(encoding);

	const currentChar = remaining[0];
	const nextChar = remaining.slice(1);

	let typeNode = null;

	for (const parser of TYPE_PARSERS) {
		if (parser.matches(currentChar, qualifiers)) {
			const ctx = {
				char: currentChar,
				remaining: nextChar,
				typeNode: null,
				qualifiers,
				substitutions,
				templateParams,
				types,
				templateDepth,
				templateStack
			};
			if (parser.isTemplateMarker) return parser.parse(ctx);
			const result = parser.parse(ctx);
			if (result !== null && ctx.typeNode) {
				typeNode = applyQualifiers(ctx.typeNode, qualifiers);
				const wrapper = new TypeParseNode(typeNode);
				return new ParseResult(wrapper, result, templateDepth, templateStack);
			}
		}
	}

	return new ParseResult(null, nextChar, templateDepth, templateStack);
}

TypeFormatter.needsTypeSeparator = function (index, type, prevType) {
	return index > 0 && !type.templateEnd && !(prevType && prevType.templateStart);
}

TypeFormatter.processTypeForSerialization = function (type, result, index, prevType, templateDepth) {
	if (this.needsTypeSeparator(index, type, prevType)) result.push(', ');
	result.push(type.toString());
	return templateDepth + (type.templateStart ? 1 : 0) + (type.templateEnd ? -1 : 0);
}

TypeFormatter.serializeTypeList = function (types) {
	const result = [];
	let templateDepth = 0;

	// Special case: single void parameter with no qualifiers should be empty
	if (types.length === 1 && types[0].typeNode instanceof BasicType && types[0].typeNode.name === 'void' && !types[0].isQualified()) {
		return '';
	}

	for (let i = 0; i < types.length; i++) {
		templateDepth = this.processTypeForSerialization(types[i], result, i, types[i - 1], templateDepth);
	}

	return result.join('');
}
