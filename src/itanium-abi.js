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

		const { remaining: afterVendorPostfix } = parseVendorPostfix(name.slice(2));

		if (afterVendorPostfix[0] === 'T' || afterVendorPostfix[0] === 'G') {
			const specialResult = parseSpecialName(afterVendorPostfix);
			if (specialResult) return specialResult;
		}

		const { name: functionName, str: afterName, isConst = false, templateArgs = [] } = parseEncodedName(afterVendorPostfix);
		const { templateParams, str: afterTemplate } = parseTemplatePlaceholders(afterName);

		const allTemplateParams = templateArgs.length > 0 ? templateArgs : templateParams;

		const substitutions = buildSubstitutions(functionName, allTemplateParams);
		const { returnType, remaining } = parseReturnTypeIfNeeded(afterTemplate, allTemplateParams, substitutions);

		const { types } = parseTypeList(remaining, substitutions, allTemplateParams);

		return new FormatVisitor().formatFunctionSignature(functionName, types, isConst, returnType);
	}
};

class TypeNode {
	accept(visitor) {
		throw new Error('accept() must be implemented by subclass');
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
		this.numPtr = qualifiers.numPtr || 0;
		this.isRef = qualifiers.isRef || false;
		this.isRValueRef = qualifiers.isRValueRef || false;
	}

	accept(visitor) {
		return visitor.visitQualifiedType(this);
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

class MemberPointerType extends TypeNode {
	constructor(classType, memberType) {
		super();
		this.classType = classType;
		this.memberType = memberType;
	}

	accept(visitor) {
		return visitor.visitMemberPointerType(this);
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

class TypeVisitor {
	visitNamedType(node) { throw new Error('visitNamedType not implemented'); }
	visitQualifiedType(node) { throw new Error('visitQualifiedType not implemented'); }
	visitArrayType(node) { throw new Error('visitArrayType not implemented'); }
	visitFunctionPointerType(node) { throw new Error('visitFunctionPointerType not implemented'); }
	visitMemberFunctionPointerType(node) { throw new Error('visitMemberFunctionPointerType not implemented'); }
	visitMemberPointerType(node) { throw new Error('visitMemberPointerType not implemented'); }
	visitTemplateType(node) { throw new Error('visitTemplateType not implemented'); }
}

class FormatVisitor extends TypeVisitor {
	visitNamedType(node) {
		return node.name;
	}

	visitQualifiedType(node) {
		let result = '';

		if (node.isConst) result += 'const ';
		if (node.isVolatile) result += 'volatile ';

		result += node.baseType.accept(this);

		result += '*'.repeat(node.numPtr);

		if (node.isRestrict) result += ' restrict';
		if (node.isRef) result += '&';
		if (node.isRValueRef) result += '&&';

		return result;
	}

	visitArrayType(node) {
		const baseFormat = node.elementType.accept(this);
		const dimensionsStr = node.dimensions.map(dim => `[${dim}]`).join('');
		return baseFormat + dimensionsStr;
	}

	visitFunctionPointerType(node) {
		const params = this.formatParameterList(node.paramTypes);
		const returnTypeStr = node.returnType.accept(this);
		return `${returnTypeStr} (*)(${params})`;
	}

	visitMemberFunctionPointerType(node) {
		const params = this.formatParameterList(node.paramTypes);
		const returnTypeStr = node.returnType.accept(this);
		const classTypeStr = node.classType.accept(this);
		const constQualifier = node.isConst ? ' const' : '';
		return `${returnTypeStr} (${classTypeStr}::*)(${params})${constQualifier}`;
	}

	visitMemberPointerType(node) {
		const memberTypeStr = node.memberType.accept(this);
		const classTypeStr = node.classType.accept(this);
		return `${memberTypeStr} ${classTypeStr}::**`;
	}

	visitTemplateType(node) {
		const args = node.templateArgs.map(arg => arg.accept(this)).join(', ');
		return `${node.baseName}<${args}>`;
	}

	formatParameterList(types) {
		// Render as empty when there is only a single 'void' parameter
		if (types.length === 1 && types[0].accept(this) === 'void') {
			return '';
		}

		return types.map(type => type.accept(this)).join(', ');
	}

	formatFunctionSignature(functionName, parameterTypes, isConst = false, returnType = null) {
		const parameterList = this.formatParameterList(parameterTypes);
		const constQualifier = isConst ? ' const' : '';
		const returnTypePart = returnType ? `${returnType.accept(this)} ` : '';
		return `${returnTypePart}${functionName}(${parameterList})${constQualifier}`;
	}
}

function parseVendorPostfix(name) {
	const dotIndex = name.indexOf('.');

	if (dotIndex < 0)
		return { remaining: name, vendorPostfix: null };

	return { remaining: name.slice(0, dotIndex), vendorPostfix: name.slice(dotIndex) };
}

function parseSpecialName(encoding) {
	if (encoding.length < 2) return null;

	const prefix = encoding.slice(0, 2);
	const remaining = encoding.slice(2);

	const specialNames = {
		'TI': 'typeinfo for ',
		'TS': 'typeinfo name for ',
		'TV': 'vtable for ',
		'TT': 'VTT for ',
		'TC': 'construction vtable for ',
		'GV': 'guard variable for ',
		'TH': 'TLS init function for ',
		'TW': 'TLS wrapper function for '
	};

	const specialPrefix = specialNames[prefix];
	if (!specialPrefix) return null;

	const { name: typeName } = parseEncodedName(remaining);
	return `${specialPrefix}${typeName}`;
}

function buildSubstitutions(functionName, templateParams) {
	const substitutions = [];
	if (functionName.includes('::')) {
		const lastColonIndex = functionName.lastIndexOf('::');
		substitutions.push(new NamedType(functionName.substring(0, lastColonIndex)));
	}

	return [...substitutions, ...templateParams];
}

function parseReturnTypeIfNeeded(remaining, templateParams, substitutions) {
	if (templateParams.length > 0 && remaining.length > 0) {
		const result = parseSingleType(remaining, substitutions, templateParams);
		return { returnType: result.typeNode, remaining: result.remaining };
	}
	return { returnType: null, remaining };
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
		if (!segment) return { name: '', str, isConst: false, templateArgs: [] };

		const { args, str: after } = parseTemplateArgs(remaining, []);
		if (args && args.length > 0) {
			const templateType = new TemplateType(segment, args);
			const visitor = new FormatVisitor();
			return { name: templateType.accept(visitor), str: after, isConst: false, templateArgs: args };
		}

		return { name: segment, str: remaining, isConst: false, templateArgs: [] };
	}

	let remaining = str.slice(1);
	const { isConst, remaining: afterConst } = parseConstQualifier(remaining);
	const { segments: stdSegments, remaining: afterStd } = parseStdPrefix(str, afterConst);
	const { segments, remaining: afterSegments } = parseNamespaceSegments(afterStd, stdSegments);
	const finalRemaining = afterSegments[0] === 'E' ? afterSegments.slice(1) : afterSegments;
	return { name: segments.join('::'), str: finalRemaining, isConst, templateArgs: [] };
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
			const { typeNode, remaining: after } = parseSingleType(remaining, tempSubs, []);
			if (!typeNode) break;
			args.push(typeNode);
			remaining = after;
		}
	}

	if (remaining[0] === 'E') remaining = remaining.slice(1);
	return { args, str: remaining };
}

function parseTemplatePlaceholders(str) {
	if (str[0] !== 'I') return { templateParams: [], str };

	const templateParams = [];
	let remaining = str.slice(1);

	while (remaining.length > 0 && remaining[0] !== 'E') {
		const { typeNode, remaining: newRemaining } = parseSingleType(remaining, [], []);
		if (typeNode) templateParams.push(typeNode);
		remaining = newRemaining;
	}

	return { templateParams, str: remaining[0] === 'E' ? remaining.slice(1) : remaining };
}

function parseTypeList(encoding, substitutions = [], templateParams = []) {
	const types = [];
	let remaining = encoding;

	while (remaining.length > 0) {
		const { typeNode, remaining: newRemaining } = parseSingleType(remaining, substitutions, templateParams);

		if (typeNode) {
			types.push(typeNode);
			substitutions.push(typeNode);
			remaining = newRemaining;
		} else {
			// Skip unrecognized characters
			remaining = remaining.slice(1);
		}
	} return { types };
}

function parseArrayType(str, substitutions = [], templateParams = []) {
	const sizeMatch = /^(\d+)_/.exec(str);
	if (!sizeMatch) return { typeNode: null, str };

	const { typeNode: innerType, remaining } = parseSingleType(str.slice(sizeMatch[0].length), substitutions, templateParams);
	if (!innerType) return { typeNode: null, str };

	// Extract dimensions from nested arrays
	const dimensions = [sizeMatch[1]];
	let elementType = innerType;

	// If the inner type is an ArrayType (possibly wrapped in QualifiedType), flatten the dimensions
	let actualInnerType = innerType;
	if (innerType instanceof QualifiedType) {
		actualInnerType = innerType.baseType;
	}
	
	if (actualInnerType instanceof ArrayType) {
		dimensions.push(...actualInnerType.dimensions);
		elementType = actualInnerType.elementType;
	}

	const typeNode = new ArrayType(elementType, dimensions);
	return { typeNode, str: remaining };
}

function parseFunctionSignature(str, substitutions = [], templateParams = []) {
	const { typeNode: returnType, remaining: afterReturn } = parseSingleType(str, substitutions, templateParams);
	if (!returnType) return { returnType: null, params: [], remaining: str };

	const params = [];
	let remaining = afterReturn;

	while (remaining.length > 0 && remaining[0] !== 'E') {
		const { typeNode, remaining: afterParam } = parseSingleType(remaining, substitutions, templateParams);
		if (typeNode) params.push(typeNode);
		remaining = afterParam;
	}

	return { returnType, params, remaining: remaining[0] === 'E' ? remaining.slice(1) : remaining };
}

function parseFunctionType(str, substitutions = [], templateParams = []) {
	const { returnType, params, remaining } = parseFunctionSignature(str, substitutions, templateParams);
	if (!returnType) return { typeNode: null, str };

	const typeNode = new FunctionPointerType(returnType, params);
	return { typeNode, str: remaining };
}

function parseMemberFunctionPointer(str, substitutions = [], templateParams = []) {
	const { typeNode: classType, remaining: afterClass } = parseSingleType(str, substitutions, templateParams);
	if (!classType) return { typeNode: null, str };

	let remaining = afterClass;
	const isConst = remaining[0] === 'K';
	if (isConst) remaining = remaining.slice(1);

	// If it's a function pointer (has 'F' marker)
	if (remaining[0] === 'F') {
		const { returnType, params, remaining: afterSignature } = parseFunctionSignature(remaining.slice(1), substitutions, templateParams);
		if (!returnType) return { typeNode: null, str };

		const typeNode = new MemberFunctionPointerType(classType, returnType, params, isConst);
		return { typeNode, str: afterSignature };
	}

	// Otherwise it's a pointer to member data - parse the member type
	const { typeNode: memberType, remaining: afterMember } = parseSingleType(remaining, substitutions, templateParams);
	if (!memberType) return { typeNode: null, str };

	// Create a special representation for pointer-to-member-data
	const typeNode = new MemberPointerType(classType, memberType);
	return { typeNode, str: afterMember };
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
		return { typeNode: substitutions[0], str: str.slice(1) };
	}

	const subMatch = /^(\d+)_/.exec(str);
	if (subMatch) {
		const index = parseInt(subMatch[1], 10);
		return { typeNode: substitutions[index], str: str.slice(subMatch[0].length) };
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

const TYPE_PARSERS = [
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
			const baseType = new NamedType(typeName);
			const typeNode = new QualifiedType(baseType, ctx.qualifiers);
			return { typeNode, remaining: ctx.remaining };
		}
	},
	{
		matches: (char) => char === 'A',
		parse: (ctx) => {
			const result = parseArrayType(ctx.remaining, ctx.substitutions, ctx.templateParams);
			const typeNode = result.typeNode ? new QualifiedType(result.typeNode, ctx.qualifiers) : null;
			return { typeNode, remaining: result.str };
		}
	},
	{
		matches: (char) => char === 'F',
		parse: (ctx) => {
			const result = parseFunctionType(ctx.remaining, ctx.substitutions, ctx.templateParams);
			let typeNode = null;
			if (result.typeNode) {
				// Function pointer notation already includes the pointer semantics
				const adjustedQualifiers = { ...ctx.qualifiers, numPtr: 0 };
				typeNode = new QualifiedType(result.typeNode, adjustedQualifiers);
			}
			return { typeNode, remaining: result.str };
		}
	},
	{
		matches: (char) => char === 'M',
		parse: (ctx) => {
			const result = parseMemberFunctionPointer(ctx.remaining, ctx.substitutions, ctx.templateParams);
			let typeNode = null;
			if (result.typeNode) {
				// Member pointer notation already includes the pointer semantics
				const adjustedQualifiers = { ...ctx.qualifiers, numPtr: 0 };
				typeNode = new QualifiedType(result.typeNode, adjustedQualifiers);
			}
			return { typeNode, remaining: result.str };
		}
	},
	{
		matches: (char) => char === 'T',
		parse: (ctx) => {
			const result = parseTemplateParam(ctx.remaining, ctx.templateParams);
			const typeNode = result.typeNode ? new QualifiedType(result.typeNode, ctx.qualifiers) : null;
			return { typeNode, remaining: result.str };
		}
	},
	{
		matches: (char) => char === 'S',
		parse: (ctx) => {
			const result = parseStdType(ctx.remaining, ctx.substitutions);
			if (!result.typeNode) {
				return { typeNode: null, remaining: result.str };
			}

			const { args, str } = parseTemplateArgs(result.str, ctx.substitutions);
			let baseType;
			if (args && args.length > 0) {
				const visitor = new FormatVisitor();
				const baseName = result.typeNode.accept(visitor);
				baseType = new TemplateType(baseName, args);
			} else {
				baseType = result.typeNode;
			}
			const typeNode = new QualifiedType(baseType, ctx.qualifiers);
			return { typeNode, remaining: str };
		}
	},
	{
		matches: (char) => !isNaN(parseInt(char, 10)) || char === 'N',
		parse: (ctx) => {
			const { name, str } = parseEncodedName(ctx.char + ctx.remaining);
			const baseType = new NamedType(name);
			const typeNode = new QualifiedType(baseType, ctx.qualifiers);
			ctx.substitutions.push(typeNode);
			return { typeNode, remaining: str };
		}
	},
	{
		matches: () => true,
		parse: (ctx) => ({ typeNode: null, remaining: ctx.remaining })
	}
];

function parseSingleType(encoding, substitutions = [], templateParams = []) {
	const { qualifiers, remaining } = parseQualifiers(encoding);
	const currentChar = remaining[0];
	const remainder = remaining.slice(1);

	for (const parser of TYPE_PARSERS) {
		if (parser.matches(currentChar)) {
			const ctx = {
				char: currentChar,
				remaining: remainder,
				qualifiers,
				substitutions,
				templateParams
			};

			return parser.parse(ctx);
		}
	}
}
