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
		const parameterList = serializeTypeList(types);
		
		return `${functionName}(${parameterList})${isConst ? ' const' : ''}`;
	}
};

function buildSubstitutions(functionName, templateParams) {
	const substitutions = [];
	if (functionName.includes('::')) {
		const lastColonIndex = functionName.lastIndexOf('::');
		substitutions.push(functionName.substring(0, lastColonIndex));
	}
	for (const param of templateParams) {
		substitutions.push(param.toString());
	}
	return substitutions;
}

function skipReturnTypeIfNeeded(remaining, templateParams, substitutions) {
	if (templateParams.length > 0 && remaining.length > 0) {
		return parseTypeHelper(remaining, substitutions, templateParams).remaining;
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
		matches: (str) => /^[a-z][a-zA-Z]/.test(str) && getOperatorName(str.slice(0,2)),
		parse: (str) => ({ segment: getOperatorName(str.slice(0,2)), remaining: str.slice(2) })
	},
	{
		matches: (str) => /^(\d+)/.test(str),
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
			return { ...parser.parse(str, { className }), isSpecial: true };
		}
	}
	// Fallback length-prefixed parse (may hit if no parser matched)
	const { value, remaining } = parseLengthPrefixed(str);
	const segment = value === '_GLOBAL__N_1' ? '(anonymous namespace)' : value;
	return { segment, remaining, isSpecial: false };
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
	const { name, str } = parseAndAttachTemplates(afterSegment, segment, [], { lengthOnly: false });
	return { segment: name, remaining: str };
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
		const { name, str: after } = parseAndAttachTemplates(remaining, segment, [], { lengthOnly: true });
		return { name, str: after, isConst: false };
	}
	let remaining = str.slice(1);
	const { isConst, remaining: afterConst } = parseConstQualifier(remaining);
	const { segments: stdSegments, remaining: afterStd } = parseStdPrefix(str, afterConst);
	const { segments, remaining: afterSegments } = parseNamespaceSegments(afterStd, stdSegments);
	const finalRemaining = afterSegments[0] === 'E' ? afterSegments.slice(1) : afterSegments;
	return { name: segments.join('::'), str: finalRemaining, isConst };
}

function parseAndAttachTemplates(str, baseName, substitutions = [], { lengthOnly = false } = {}) {
	if (str[0] !== 'I') return { name: baseName, str };
	if (lengthOnly && !(str[1] && /\d/.test(str[1]))) return { name: baseName, str };
	const isLengthPrefixed = str[1] && /\d/.test(str[1]);
	let remaining = str.slice(1);
	const args = [];
	if (isLengthPrefixed) {
		while (remaining.length > 0 && remaining[0] !== 'E') {
			const { value, remaining: after } = parseLengthPrefixed(remaining);
			if (!value) break;
			args.push(value);
			remaining = after;
		}
	} else {
		const tempSubs = [...substitutions];
		while (remaining.length > 0 && remaining[0] !== 'E') {
			const { typeInfo, remaining: after } = parseTypeHelper(remaining, tempSubs, []);
			if (!typeInfo) break;
			args.push(typeInfo.toString());
			remaining = after;
		}
	}
	const close = remaining[0] === 'E';
	if (close) remaining = remaining.slice(1);
	return { name: `${baseName}<${args.join(', ')}${close ? '>' : ''}`, str: remaining };
}

const parseTypeHelper = (str, substitutions = [], templateParams = []) => 
	parseSingleType(str, [], 0, [], substitutions, templateParams);

function parseArrayType(str, substitutions = [], templateParams = []) {
	const sizeMatch = /^(\d+)_/.exec(str);
	if (!sizeMatch) return { typeStr: '', str };

	const { typeInfo, remaining } = parseTypeHelper(str.slice(sizeMatch[0].length), substitutions, templateParams);
	if (!typeInfo) return { typeStr: '', str };

	const elementType = typeInfo.toString();
	const arrayMatch = /^(.+?)(\[.+\])$/.exec(elementType);
	const typeStr = arrayMatch 
		? `${arrayMatch[1]}[${sizeMatch[1]}]${arrayMatch[2]}`
		: `${elementType}[${sizeMatch[1]}]`;

	return { typeStr, str: remaining };
}

function parseFunctionSignature(str, substitutions = [], templateParams = []) {
	const { typeInfo: returnType, remaining: afterReturn } = parseTypeHelper(str, substitutions, templateParams);
	if (!returnType) return { returnType: null, params: [], remaining: str };

	const params = [];
	let remaining = afterReturn;

	while (remaining.length > 0 && remaining[0] !== 'E') {
		const { typeInfo, remaining: afterParam } = parseTypeHelper(remaining, substitutions, templateParams);
		if (typeInfo) params.push(typeInfo.toString());
		remaining = afterParam;
	}

	return { returnType, params, remaining: remaining[0] === 'E' ? remaining.slice(1) : remaining };
}

const formatParameterList = (params) => 
	params.length === 0 || (params.length === 1 && params[0] === 'void') ? '' : params.join(', ');

function parseFunctionType(str, substitutions = [], templateParams = []) {
	const { returnType, params, remaining } = parseFunctionSignature(str, substitutions, templateParams);
	if (!returnType) return { typeStr: '', str };

	return { 
		typeStr: `${returnType.toString()} (*)(${formatParameterList(params)})`, 
		str: remaining 
	};
}

function parseMemberFunctionPointer(str, substitutions = [], templateParams = []) {
	const { typeInfo: classType, remaining: afterClass } = parseTypeHelper(str, substitutions, templateParams);
	if (!classType) return { typeStr: '', str };

	let remaining = afterClass;
	const isConst = remaining[0] === 'K';
	if (isConst) remaining = remaining.slice(1);

	if (remaining[0] !== 'F') return { typeStr: '', str };

	const { returnType, params, remaining: afterSignature } = parseFunctionSignature(remaining.slice(1), substitutions, templateParams);
	if (!returnType) return { typeStr: '', str };

	return { 
		typeStr: `${returnType.toString()} (${classType.toString()}::*)(${formatParameterList(params)})${isConst ? ' const' : ''}`,
		str: afterSignature 
	};
}

function parseTemplateParam(str, templateParams = []) {
	if (str[0] === '_') {
		return { 
			typeStr: templateParams.length > 0 ? templateParams[0].toString() : '', 
			str: str.slice(1) 
		};
	}

	const match = /^(\d+)_/.exec(str);
	if (match) {
		const index = parseInt(match[1], 10);
		return { 
			typeStr: index < templateParams.length ? templateParams[index].toString() : '', 
			str: str.slice(match[0].length) 
		};
	}

	return { typeStr: '', str };
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
		return { typeStr: substitutions[0] || '', str: str.slice(1) };
	}

	const subMatch = /^(\d+)_/.exec(str);
	if (subMatch) {
		const index = parseInt(subMatch[1], 10);
		return { typeStr: substitutions[index] || '', str: str.slice(subMatch[0].length) };
	}

	if (str[0] === 't') {
		const { name, str: remaining } = parseEncodedName(str.slice(1));
		return { typeStr: `std::${name}`, str: remaining };
	}

	if (stdTypeMap[str[0]]) {
		return { typeStr: stdTypeMap[str[0]], str: str.slice(1) };
	}

	if (!isNaN(parseInt(str[0], 10))) {
		const { name, str: remaining } = parseEncodedName(str);
		return { typeStr: `std::${name}`, str: remaining };
	}

	return { typeStr: '', str };
}

function parseTemplatePlaceholders(str) {
	if (str[0] !== 'I') return { templateParams: [], str };

	const templateParams = [];
	let remaining = str.slice(1);

	while (remaining.length > 0 && remaining[0] !== 'E') {
		const { typeInfo, remaining: newRemaining } = parseTypeHelper(remaining, [], []);
		if (typeInfo) templateParams.push(typeInfo);
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

		if (result.typeInfo) {
			types.push(result.typeInfo);
			if (!result.typeInfo.templateStart && !result.typeInfo.templateEnd) {
				substitutions.push(result.typeInfo.toString());
			}
		}

		remaining = result.remaining;
		templateDepth = result.templateDepth;
		templateStack = result.templateStack;
	}

	return { types };
}

/**
 * Represents type information with formatting capabilities
 */
class TypeInfo {
	constructor() {
		this.isBase = true;
		this.typeStr = "";
		this.isConst = false;
		this.isVolatile = false;
		this.isRestrict = false;
		this.isRef = false;
		this.isRValueRef = false;
		this.numPtr = 0;
		this.templateStart = false;
		this.templateEnd = false;
		this.templateType = null;
	}

	/**
	 * Formats reference and pointer qualifiers
	 * @returns {string} Formatted qualifiers
	 */
	formatReferenceAndPointers() {
		return (this.isRef ? '&' : '') + (this.isRValueRef ? '&&' : '') + '*'.repeat(this.numPtr);
	}

	toString() {
		let result = '';
		if (this.isConst) result += 'const ';
		if (this.isVolatile) result += 'volatile ';
		result += this.typeStr;
		if (this.templateStart) result += '<';
		if (this.templateEnd) result += '>';
		if (!this.templateStart) {
			result += this.formatReferenceAndPointers();
			if (this.isRestrict) result += ' __restrict';
		}
		if (this.templateType) result += this.templateType.formatReferenceAndPointers();
		return result;
	}
}

class ParseResult {
	constructor(typeInfo, remaining, templateDepth, templateStack) {
		this.typeInfo = typeInfo;
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
			ctx.typeInfo.templateEnd = true;
			const newDepth = ctx.templateDepth - 1;
			ctx.typeInfo.templateType = ctx.templateStack[newDepth];
			return new ParseResult(ctx.typeInfo, ctx.remaining, newDepth, ctx.templateStack.slice(0, -1));
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
			'l': 'long int',
			'm': 'unsigned long int',
			'x': 'long long int',
			'y': 'unsigned long long int',
			'n': '__int128',
			'o': 'unsigned __int128',
			'f': 'float',
			'd': 'double',
			'e': 'long double',
			'g': '__float128',
			'z': '...'
		},
		matches: function(char, qualifiers) {
			return this.basicTypes[char] !== undefined;
		},
		parse: function(ctx) {
			ctx.typeInfo.typeStr = this.basicTypes[ctx.char];
			return ctx.remaining;
		}
	},
	{
		matches: (char) => char === 'A',
		parse: (ctx) => {
			const result = parseArrayType(ctx.remaining, ctx.substitutions, ctx.templateParams);
			if (result.typeStr) {
				ctx.typeInfo.typeStr = result.typeStr;
				return result.str;
			}
			return null;
		}
	},
	{
		matches: (char, qualifiers) => char === 'F' && qualifiers.numPtr > 0,
		parse: (ctx) => {
			const result = parseFunctionType(ctx.remaining, ctx.substitutions, ctx.templateParams);
			if (result.typeStr) {
				ctx.typeInfo.typeStr = result.typeStr;
				ctx.typeInfo.numPtr = 0;  // Function pointer notation already includes the pointer
				return result.str;
			}
			return null;
		}
	},
	{
		matches: (char) => char === 'M',
		parse: (ctx) => {
			const result = parseMemberFunctionPointer(ctx.remaining, ctx.substitutions, ctx.templateParams);
			if (result.typeStr) {
				ctx.typeInfo.typeStr = result.typeStr;
				return result.str;
			}
			return null;
		}
	},
	{
		matches: (char) => char === 'T',
		parse: (ctx) => {
			const result = parseTemplateParam(ctx.remaining, ctx.templateParams);
			if (result.typeStr) {
				ctx.typeInfo.typeStr = result.typeStr;
				return result.str;
			}
			return null;
		}
	},
	{
		matches: (char) => char === 'S',
		parse: (ctx) => {
			const result = parseStdType(ctx.remaining, ctx.substitutions);
			// Check for template arguments after the std type
			const withTemplates = parseAndAttachTemplates(result.str, result.typeStr, ctx.substitutions, { lengthOnly: false });
			ctx.typeInfo.typeStr = withTemplates.name;
			return withTemplates.str;
		}
	},
	{
		matches: (char) => !isNaN(parseInt(char, 10)) || char === 'N',
		parse: (ctx) => {
			const { name, str } = parseEncodedName(ctx.char + ctx.remaining);
			ctx.typeInfo.typeStr = name;
			ctx.substitutions.push(name);
			return str;
		}
	}
];

function parseSingleType(encoding, types, templateDepth, templateStack, substitutions = [], templateParams = []) {
	let remaining = encoding;
	const typeInfo = new TypeInfo();
	const qualifierActions = {
		R: () => typeInfo.isRef = true,
		O: () => typeInfo.isRValueRef = true,
		r: () => typeInfo.isRestrict = true,
		V: () => typeInfo.isVolatile = true,
		K: () => typeInfo.isConst = true,
		P: () => typeInfo.numPtr++
	};
	while (qualifierActions[remaining[0]]) {
		qualifierActions[remaining[0]]();
		remaining = remaining.slice(1);
	}
	const currentChar = remaining[0];
	const afterChar = remaining.slice(1);

	for (const parser of TYPE_PARSERS) {
		if (parser.matches(currentChar, typeInfo)) {
			const ctx = {
				char: currentChar,
				remaining: afterChar,
				typeInfo,
				substitutions,
				templateParams,
				types,
				templateDepth,
				templateStack
			};
			if (parser.isTemplateMarker) return parser.parse(ctx);
			const result = parser.parse(ctx);
			if (result !== null && typeInfo.typeStr) {
				return new ParseResult(typeInfo, result, templateDepth, templateStack);
			}
		}
	}
	return new ParseResult(null, afterChar, templateDepth, templateStack);
}

const needsTypeSeparator = (index, type, prevType) => 
	index > 0 && !type.templateEnd && !(prevType && prevType.templateStart);

function processTypeForSerialization(type, result, index, prevType, templateDepth) {
	if (needsTypeSeparator(index, type, prevType)) result.push(', ');
	result.push(type.toString());
	return templateDepth + (type.templateStart ? 1 : 0) + (type.templateEnd ? -1 : 0);
}

function serializeTypeList(types) {
	const result = [];
	let templateDepth = 0;

	for (let i = 0; i < types.length; i++) {
		templateDepth = processTypeForSerialization(types[i], result, i, types[i - 1], templateDepth);
	}

	return result.join('');
}
