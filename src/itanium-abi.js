/**
 * Demangles C++ function names mangled according to the IA64 C++ ABI
 *
 * This is means that this file demangles function names mangled by GCC and Clang.
 *
 * Material used: https://itanium-cxx-abi.github.io/cxx-abi/abi.html#mangling
 */

module.exports = {
	/**
	 * Check if the name passed is a IA64 ABI mangled name
	 * @param {string} name - The name to check
	 * @returns {boolean} True if the name is mangled
	 */
	isMangled: function (name) {
		return name.startsWith("_Z");
	},

	/**
	 * Demangles a C++ function name
	 * @param {string} name - The mangled name
	 * @returns {string} The demangled function signature
	 */
	demangle: function (name) {
		if (!this.isMangled(name)) return name;

		// Encoding is the part between the _Z (the "mangling mark") and the dot, that prefix
		// a vendor specific suffix. That suffix will not be treated here yet
		const dotIndex = name.indexOf('.');
		const encoding = dotIndex < 0 ? name.slice(2) : name.slice(2, dotIndex);

		const functionNameResult = popName(encoding);
		const functionName = functionNameResult.name;
		const isConst = functionNameResult.isConst || false;

		// Parse template parameters if present (I...E section after function name)
		const templateResult = parseTemplatePlaceholders(functionNameResult.str);
		const templateParams = templateResult.templateParams;
		let remainingAfterTemplate = templateResult.str;

		// Build substitution list: for member functions, the class/namespace is the first substitution
		const substitutions = [];
		if (functionName.includes('::')) {
			// Extract class/namespace name (everything before the last ::)
			const lastColonIndex = functionName.lastIndexOf('::');
			const className = functionName.substring(0, lastColonIndex);
			substitutions.push(className);
		}

		// Template parameters themselves become substitution candidates
		if (templateParams.length > 0) {
			for (const param of templateParams) {
				substitutions.push(formatTypeInfo(param));
			}
		}

		// For function templates, skip the return type (it comes after template params but before parameter types)
		if (templateParams.length > 0 && remainingAfterTemplate.length > 0) {
			const { remaining: afterReturnType } = parseTypeHelper(remainingAfterTemplate, substitutions, templateParams);
			remainingAfterTemplate = afterReturnType;
		}

		// Process the types
		const parseResult = parseTypeList(remainingAfterTemplate, substitutions, templateParams);
		const types = parseResult.types;

		// Serialize types with proper template context awareness
		const parameterList = serializeTypeList(types);
		let signature = functionName + "(" + parameterList + ")";
		
		// Add const qualifier for member functions
		if (isConst) {
			signature += " const";
		}

		return signature;
	}
};

/**
 * Parses a length-prefixed string (common pattern in mangling)
 * @param {string} str - String starting with a length prefix
 * @returns {{value: string, remaining: string}} Parsed value and remaining string
 */
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

/**
 * Maps operator codes to their C++ representations
 * @param {string} code - Two-letter operator code
 * @returns {string|null} Operator name or null if not an operator
 */
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

/**
 * Parses a single name segment (length-prefixed, operator, constructor, or destructor)
 * @param {string} str - String starting with a length prefix or special code
 * @param {string} className - Current class name for constructor/destructor naming
 * @returns {{segment: string, remaining: string, isSpecial: boolean}} Parsed segment info
 */
function parseNameSegment(str, className = '') {
	// Check for constructors (C1, C2, C3)
	if (/^C[123]/.test(str)) {
		return { segment: className, remaining: str.slice(2), isSpecial: true };
	}
	
	// Check for destructors (D0, D1, D2)
	if (/^D[012]/.test(str)) {
		return { segment: '~' + className, remaining: str.slice(2), isSpecial: true };
	}
	
	// Check for operator names (two characters, first is lowercase)
	if (/^[a-z][a-zA-Z]/.test(str)) {
		const opCode = str.slice(0, 2);
		const opName = getOperatorName(opCode);
		if (opName) {
			return { segment: opName, remaining: str.slice(2), isSpecial: false };
		}
	}
	
	const result = parseLengthPrefixed(str);

	// Handle anonymous namespace
	if (result.value === "_GLOBAL__N_1") {
		return { segment: "(anonymous namespace)", remaining: result.remaining, isSpecial: false };
	}

	return { segment: result.value, remaining: result.remaining, isSpecial: false };
}

/**
 * Checks if string starts with std:: marker
 * @param {string} str - String to check
 * @returns {boolean} True if starts with St marker
 */
function startsWithStdMarker(str) {
	return str.slice(1, 3) === "St";
}

/**
 * Parses a nested namespace path (starts with 'N', ends with 'E')
 * @param {string} str - String starting with 'N'
 * @returns {{name: string, str: string, isConst: boolean}} Parsed namespace path, remaining string, and const qualifier
 */
function parseNestedNamespace(str) {
	let remaining = str.slice(1); // Skip 'N'
	const segments = [];
	let isConst = false;
	
	// Check for const qualifier (K after N)
	if (remaining[0] === 'K') {
		isConst = true;
		remaining = remaining.slice(1);
	}

	// Handle std:: prefix
	if (startsWithStdMarker(str)) {
		segments.push("std");
		remaining = remaining.replace("St", "");
	}

	// Parse all namespace/class segments until 'E' or 'I'
	while (remaining.length > 0) {
		const firstChar = remaining[0];
		
		// End of nested namespace
		if (firstChar === 'E' || firstChar === 'I') {
			break;
		}
		
		// Must be a digit, lowercase letter (operator), or C/D (constructor/destructor)
		if (!/\d/.test(firstChar) && !/[a-zCD]/.test(firstChar)) {
			break;
		}

		// Get the current class name (last non-special segment) for constructor/destructor
		const className = segments.length > 0 ? segments[segments.length - 1].replace(/^operator.*/, '').trim() : '';
		
		// Parse one segment
		const segmentResult = parseNameSegment(remaining, className);
		if (!segmentResult.segment) {
			break;
		}
		
		segments.push(segmentResult.segment);
		remaining = segmentResult.remaining;

		// Check for template arguments on this segment
		if (remaining[0] === 'I') {
			const lastSegment = segments[segments.length - 1];
			const templateResult = parseTemplateIfPresent(remaining, lastSegment);
			segments[segments.length - 1] = templateResult.name;
			remaining = templateResult.str;
		}
	}

	// Consume the terminating 'E'
	if (remaining[0] === 'E') {
		remaining = remaining.slice(1);
	}

	return { name: segments.join("::"), str: remaining, isConst: isConst };
}

/**
 * Removes a mangled name from 'remainingString', in the mangled name format
 * Returns an object with 'name' property (the name) and 'str' property (the remainder)
 * @param {string} remainingString - The mangled string to parse
 * @returns {{name: string, str: string}} Parsed name and remaining string
 */
function popName(remainingString) {
	// Check if this is a nested namespace (starts with 'N')
	if (remainingString[0] === 'N') {
		return parseNestedNamespace(remainingString);
	}

	// Simple case: single name segment
	const segmentResult = parseNameSegment(remainingString);
	if (!segmentResult.segment) {
		return { name: "", str: remainingString, isConst: false };
	}

	// Check for template arguments
	const templateResult = parseTemplateIfPresent(segmentResult.remaining, segmentResult.segment);
	return { name: templateResult.name, str: templateResult.str, isConst: false };
}

/**
 * Parses template arguments if present in the mangled name
 * @param {string} str - The string starting with potential template marker 'I'
 * @param {string} currentName - The name being built
 * @returns {{name: string, str: string}} Updated name and remaining string
 */
function parseTemplateIfPresent(str, currentName) {
	// Early returns for non-template cases
	if (str[0] !== 'I') {
		return { name: currentName, str: str };
	}

	const nextChar = str[1];
	if (!nextChar || !/\d/.test(nextChar)) {
		// If next char is not a digit (it's a type code), don't parse templates here
		return { name: currentName, str: str };
	}

	// Parse length-prefixed template arguments
	let resultName = currentName + "<";
	let remaining = str.slice(1); // Skip 'I'
	const templateArgs = [];

	while (remaining.length > 0 && remaining[0] !== 'E') {
		const result = parseLengthPrefixed(remaining);
		if (!result.value) {
			break; // Not a length-prefixed name, stop parsing templates
		}

		templateArgs.push(result.value);
		remaining = result.remaining;
	}

	resultName += templateArgs.join(", ");

	if (remaining[0] === 'E') {
		resultName += ">";
		remaining = remaining.slice(1);
	}

	return { name: resultName, str: remaining };
}

/**
 * Type qualifiers that can be parsed from mangled names
 * @typedef {Object} TypeQualifiers
 * @property {boolean} isConst
 * @property {boolean} isVolatile
 * @property {boolean} isRestrict
 * @property {boolean} isRef
 * @property {boolean} isRValueRef
 * @property {number} numPtr
 */

/**
 * Parses type qualifiers (const, volatile, pointers, references) from mangled string
 * @param {string} str - The mangled string to parse
 * @returns {{qualifiers: TypeQualifiers, str: string}} Parsed qualifiers and remaining string
 */
function parseTypeQualifiers(str) {
	const qualifiers = {
		isConst: false,
		isVolatile: false,
		isRestrict: false,
		isRef: false,
		isRValueRef: false,
		numPtr: 0
	};

	const qualifierMap = {
		'R': () => qualifiers.isRef = true,
		'O': () => qualifiers.isRValueRef = true,
		'r': () => qualifiers.isRestrict = true,
		'V': () => qualifiers.isVolatile = true,
		'K': () => qualifiers.isConst = true,
		'P': () => qualifiers.numPtr++
	};

	while (qualifierMap[str[0]]) {
		qualifierMap[str[0]]();
		str = str.slice(1);
	}

	return { qualifiers, str };
}

/**
 * Maps mangled type codes to their C++ type names
 * @param {string} typeCode - Single character type code
 * @returns {string|null} Type name or null if not a basic type
 */
function getBasicTypeName(typeCode) {
	const typeMap = {
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
	};

	return typeMap[typeCode] || null;
}

/**
 * Helper function to parse a single type with common default parameters
 * @param {string} str - The string to parse
 * @param {Array} substitutions - Array of substitutions for back-references
 * @param {Array} templateParams - Template parameter types
 * @returns {{typeInfo: Object, remaining: string}} Parsed type info and remaining string
 */
function parseTypeHelper(str, substitutions = [], templateParams = []) {
	return parseSingleType(str, [], 0, [], substitutions, templateParams);
}

/**
 * Parses array types (A<size>_<element-type>)
 * @param {string} str - String after 'A'
 * @param {Array} substitutions - Array of substitutions for back-references
 * @param {Array} templateParams - Template parameter types
 * @returns {{typeStr: string, str: string}} The parsed array type and remaining string
 */
function parseArrayType(str, substitutions = [], templateParams = []) {
	// Parse the array size (number before underscore)
	const sizeMatch = /^(\d+)_/.exec(str);
	if (!sizeMatch) {
		return { typeStr: '', str: str };
	}

	const size = sizeMatch[1];
	let remaining = str.slice(sizeMatch[0].length);

	// Parse the element type recursively
	const { typeInfo, remaining: afterType } = parseTypeHelper(remaining, substitutions, templateParams);

	if (!typeInfo) {
		return { typeStr: '', str: str };
	}

	// Format as type[size]
	// For nested arrays, we need to insert the new dimension before existing dimensions
	const elementType = formatTypeInfo(typeInfo);
	
	// Check if element type is already an array (contains '[')
	const arrayMatch = /^(.+?)(\[.+\])$/.exec(elementType);
	if (arrayMatch) {
		// Insert new dimension before existing dimensions: baseType[size][existingDims]
		const arrayType = `${arrayMatch[1]}[${size}]${arrayMatch[2]}`;
		return { typeStr: arrayType, str: afterType };
	} else {
		// Simple case: just append [size]
		const arrayType = `${elementType}[${size}]`;
		return { typeStr: arrayType, str: afterType };
	}
}

/**
 * Parses a function signature (return type and parameters until 'E')
 * @param {string} str - String starting with return type
 * @param {Array} substitutions - Array of substitutions for back-references
 * @param {Array} templateParams - Template parameter types
 * @returns {{returnType: Object, params: Array, remaining: string}} Parsed signature components
 */
function parseFunctionSignature(str, substitutions = [], templateParams = []) {
	// Parse return type
	const { typeInfo: returnType, remaining: afterReturn } = parseTypeHelper(str, substitutions, templateParams);

	if (!returnType) {
		return { returnType: null, params: [], remaining: str };
	}

	// Parse parameter types until 'E'
	const params = [];
	let remaining = afterReturn;

	while (remaining.length > 0 && remaining[0] !== 'E') {
		const { typeInfo: paramType, remaining: afterParam } = parseTypeHelper(remaining, substitutions, templateParams);

		if (paramType) {
			params.push(formatTypeInfo(paramType));
		}
		remaining = afterParam;
	}

	// Skip the closing 'E'
	if (remaining[0] === 'E') {
		remaining = remaining.slice(1);
	}

	return { returnType, params, remaining };
}

/**
 * Formats parameter list, handling empty lists and void parameters
 * @param {Array} params - Array of parameter type strings
 * @returns {string} Formatted parameter list
 */
function formatParameterList(params) {
	if (params.length === 0) {
		return '';
	} else if (params.length === 1 && params[0] === 'void') {
		return '';  // Single void parameter means empty list
	} else {
		return params.join(', ');
	}
}

/**
 * Parses function pointer types (PF<return><params>E)
 * @param {string} str - String after 'F'
 * @param {Array} substitutions - Array of substitutions for back-references
 * @param {Array} templateParams - Template parameter types
 * @returns {{typeStr: string, str: string}} The parsed function pointer type and remaining string
 */
function parseFunctionType(str, substitutions = [], templateParams = []) {
	const { returnType, params, remaining } = parseFunctionSignature(str, substitutions, templateParams);

	if (!returnType) {
		return { typeStr: '', str: str };
	}

	// Format as: return_type (*)(param1, param2, ...)
	const returnTypeStr = formatTypeInfo(returnType);
	const paramsStr = formatParameterList(params);
	const funcType = `${returnTypeStr} (*)(${paramsStr})`;

	return { typeStr: funcType, str: remaining };
}

/**
 * Parses member function pointer types (M<class><qualifiers>F<return><params>E)
 * @param {string} str - String after 'M'
 * @param {Array} substitutions - Array of substitutions for back-references
 * @param {Array} templateParams - Template parameter types
 * @returns {{typeStr: string, str: string}} The parsed member function pointer type and remaining string
 */
function parseMemberFunctionPointer(str, substitutions = [], templateParams = []) {
	// Parse the class type (length-prefixed name or type)
	const { typeInfo: classType, remaining: afterClass } = parseTypeHelper(str, substitutions, templateParams);

	if (!classType) {
		return { typeStr: '', str: str };
	}

	const className = formatTypeInfo(classType);
	let remaining = afterClass;

	// Check for const qualifier (K) before function signature
	let isConst = false;
	if (remaining[0] === 'K') {
		isConst = true;
		remaining = remaining.slice(1);
	}

	// Parse the function signature (F<return><params>E)
	if (remaining[0] !== 'F') {
		return { typeStr: '', str: str };
	}

	remaining = remaining.slice(1); // Skip 'F'

	const { returnType, params, remaining: afterSignature } = parseFunctionSignature(remaining, substitutions, templateParams);

	if (!returnType) {
		return { typeStr: '', str: str };
	}

	// Format as: return_type (ClassName::*)(param1, param2, ...) [const]
	const returnTypeStr = formatTypeInfo(returnType);
	const paramsStr = formatParameterList(params);
	const constStr = isConst ? ' const' : '';
	const funcType = `${returnTypeStr} (${className}::*)(${paramsStr})${constStr}`;

	return { typeStr: funcType, str: afterSignature };
}

/**
 * Parses template parameter references (T_, T0_, T1_, etc.)
 * @param {string} str - String after 'T'
 * @param {Array} templateParams - Array of template parameter type infos
 * @returns {{typeStr: string, str: string}} The parsed type and remaining string
 */
function parseTemplateParam(str, templateParams = []) {
	const firstChar = str[0];

	// T_ = first template parameter (index 0)
	if (firstChar === '_') {
		if (templateParams.length > 0) {
			return { typeStr: formatTypeInfo(templateParams[0]), str: str.slice(1) };
		}
		return { typeStr: '', str: str.slice(1) };
	}

	// T0_ = first (same as T_), T1_ = second, T2_ = third, etc.
	const match = /^(\d+)_/.exec(str);
	if (match) {
		const index = parseInt(match[1], 10);
		if (index < templateParams.length) {
			return { typeStr: formatTypeInfo(templateParams[index]), str: str.slice(match[0].length) };
		}
		return { typeStr: '', str: str.slice(match[0].length) };
	}

	// Not a valid template parameter reference
	return { typeStr: '', str: str };
}

/**
 * Parses std:: abbreviated types and substitutions (S-codes)
 * @param {string} str - String starting after 'S'
 * @param {Array} substitutions - Array of previously seen types/names for substitutions
 * @returns {{typeStr: string, str: string}} Parsed type and remaining string
 */
function parseStdType(str, substitutions = []) {
	const stdTypeMap = {
		'a': 'std::allocator',
		'b': 'std::basic_string',
		's': 'std::basic_string<char, std::char_traits<char>, std::allocator<char>>',
		'i': 'std::basic_istream<char, std::char_traits<char>>',
		'o': 'std::basic_ostream<char, std::char_traits<char>>',
		'd': 'std::basic_iostream<char, std::char_traits<char>>'
	};

	const firstChar = str[0];

	// Handle substitutions (S_ = first substitution, S0_ = first, S1_ = second, etc.)
	if (firstChar === '_') {
		// S_ refers to the first substitution (index 0)
		if (substitutions.length > 0) {
			return { typeStr: substitutions[0], str: str.slice(1) };
		}
		return { typeStr: '', str: str.slice(1) };
	}

	// Handle numbered substitutions: S0_ = first (same as S_), S1_ = second, S2_ = third, etc.
	const subMatch = /^(\d+)_/.exec(str);
	if (subMatch) {
		const index = parseInt(subMatch[1], 10);  // S0_ is index 0, S1_ is index 1, S2_ is index 2
		if (index < substitutions.length) {
			return { typeStr: substitutions[index], str: str.slice(subMatch[0].length) };
		}
		return { typeStr: '', str: str.slice(subMatch[0].length) };
	}

	if (firstChar === 't') {
		// It's a custom type name (St + name)
		const result = popName(str.slice(1));
		return { typeStr: "std::" + result.name, str: result.str };
	}

	if (stdTypeMap[firstChar]) {
		return { typeStr: stdTypeMap[firstChar], str: str.slice(1) };
	}

	// Check for other std types by reading the name
	if (!isNaN(parseInt(firstChar, 10))) {
		const result = popName(str);
		return { typeStr: "std::" + result.name, str: result.str };
	}

	return { typeStr: '', str: str };
}

/**
 * Parses template parameters from I...E section
 * @param {string} str - The string potentially starting with 'I'
 * @returns {{templateParams: Array, str: string}} Template parameter types and remaining string
 */
function parseTemplatePlaceholders(str) {
	if (str[0] !== 'I') {
		return { templateParams: [], str: str };
	}

	const templateParams = [];
	let remaining = str.slice(1); // Skip 'I'
	const tempSubstitutions = [];

	// Parse types until we hit 'E'
	while (remaining.length > 0 && remaining[0] !== 'E') {
		const { typeInfo, remaining: newRemaining } = parseTypeHelper(remaining, tempSubstitutions, []);

		if (typeInfo) {
			templateParams.push(typeInfo);
		}
		remaining = newRemaining;
	}

	// Skip the closing 'E'
	if (remaining[0] === 'E') {
		remaining = remaining.slice(1);
	}

	return { templateParams, str: remaining };
}

/**
 * Parses the type list from the encoding
 * @param {string} encoding - The type encoding string
 * @param {Array} substitutions - Array of substitutions for back-references
 * @param {Array} templateParams - Template parameter types for T_, T0_, T1_, etc.
 * @returns {{types: Array}} Parsed types
 */
function parseTypeList(encoding, substitutions = [], templateParams = []) {
	const types = [];
	let remainingEncoding = encoding;
	let templateDepth = 0;
	let templateStack = [];

	while (remainingEncoding.length > 0) {
		const { typeInfo, remaining, templateDepth: newDepth, templateStack: newStack } = parseSingleType(
			remainingEncoding,
			types,
			templateDepth,
			templateStack,
			substitutions,
			templateParams
		);

		if (typeInfo) {
			types.push(typeInfo);
			// Add the complete type (with qualifiers) to substitutions for future references
			// But skip template markers
			if (!typeInfo.templateStart && !typeInfo.templateEnd) {
				substitutions.push(formatTypeInfo(typeInfo));
			}
		}

		remainingEncoding = remaining;
		templateDepth = newDepth;
		templateStack = newStack;
	}

	return { types };
}

/**
 * Creates an empty type info object
 * @returns {Object} Type info object with default values
 */
function createTypeInfo() {
	return {
		isBase: true,
		typeStr: "",
		isConst: false,
		isVolatile: false,
		isRestrict: false,
		isRef: false,
		isRValueRef: false,
		numPtr: 0,
		templateStart: false,
		templateEnd: false,
		templateType: null
	};
}

/**
 * Represents the result of parsing a single type from the encoding
 */
class ParseResult {
	/**
	 * @param {Object|null} typeInfo - The parsed type info or null
	 * @param {string} remaining - Remaining encoding string
	 * @param {number} templateDepth - Template nesting depth
	 * @param {Array} templateStack - Template stack
	 */
	constructor(typeInfo, remaining, templateDepth, templateStack) {
		this.typeInfo = typeInfo;
		this.remaining = remaining;
		this.templateDepth = templateDepth;
		this.templateStack = templateStack;
	}
}

/**
 * Type parser registry using Strategy Pattern
 * Each parser handles specific type codes and directly applies necessary side effects
 */
const TYPE_PARSERS = [
	{
		// Template opening marker 'I'
		matches: (char) => char === 'I',
		parse: (ctx) => {
			// This is a special case - returns a ParseResult directly
			if (ctx.types.length > 0) {
				ctx.types[ctx.types.length - 1].templateStart = true;
				ctx.templateStack.push(ctx.types[ctx.types.length - 1]);
			}
			return new ParseResult(null, ctx.remaining, ctx.templateDepth + 1, ctx.templateStack);
		},
		isTemplateMarker: true
	},
	{
		// Template closing marker 'E'
		matches: (char) => char === 'E',
		parse: (ctx) => {
			// This is a special case - returns a ParseResult directly
			if (ctx.templateDepth <= 0) {
				return new ParseResult(null, ctx.remaining, ctx.templateDepth, ctx.templateStack);
			}
			
			ctx.typeInfo.templateEnd = true;
			const newDepth = ctx.templateDepth - 1;
			ctx.typeInfo.templateType = ctx.templateStack[newDepth];
			const newStack = ctx.templateStack.slice(0, -1);
			return new ParseResult(ctx.typeInfo, ctx.remaining, newDepth, newStack);
		},
		isTemplateMarker: true
	},
	{
		// Basic types (i, v, d, f, etc.)
		matches: (char, qualifiers) => getBasicTypeName(char) !== null,
		parse: (ctx) => {
			ctx.typeInfo.typeStr = getBasicTypeName(ctx.char);
			return ctx.remaining;
		}
	},
	{
		// Array types (A<size>_<type>)
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
		// Function pointer types (PF<return><params>E)
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
		// Member function pointer types (M<class><func>)
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
		// Template parameter placeholders (T_, T0_, T1_, etc.)
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
		// Std types and substitutions (S...)
		matches: (char) => char === 'S',
		parse: (ctx) => {
			const result = parseStdType(ctx.remaining, ctx.substitutions);
			ctx.typeInfo.typeStr = result.typeStr;
			return result.str;
		}
	},
	{
		// Custom type names (starts with digit or 'N' for namespace)
		matches: (char) => !isNaN(parseInt(char, 10)) || char === 'N',
		parse: (ctx) => {
			const result = popName(ctx.char + ctx.remaining);
			ctx.typeInfo.typeStr = result.name;
			ctx.substitutions.push(result.name);  // Add to substitutions for future references
			return result.str;
		}
	}
];

/**
 * Parses a single type from the encoding using Strategy Pattern
 * @param {string} encoding - The encoding string
 * @param {Array} types - Current types array
 * @param {number} templateDepth - Current template nesting depth
 * @param {Array} templateStack - Current template stack
 * @param {Array} substitutions - Array of substitutions for back-references
 * @param {Array} templateParams - Template parameter types
 * @returns {ParseResult} Parse result with typeInfo and remaining string
 */
function parseSingleType(encoding, types, templateDepth, templateStack, substitutions = [], templateParams = []) {
	// Parse type qualifiers first
	const qualifierResult = parseTypeQualifiers(encoding);
	const currentChar = qualifierResult.str[0];
	const remainingAfterQualifiers = qualifierResult.str.slice(1);

	// Find and execute matching parser strategy
	for (const parser of TYPE_PARSERS) {
		if (parser.matches(currentChar, qualifierResult.qualifiers)) {
			// Create context object with all necessary data
			const typeInfo = createTypeInfo();
			Object.assign(typeInfo, qualifierResult.qualifiers);
			
			const ctx = {
				char: currentChar,
				remaining: remainingAfterQualifiers,
				qualifiers: qualifierResult.qualifiers,
				typeInfo: typeInfo,
				substitutions: substitutions,
				templateParams: templateParams,
				types: types,
				templateDepth: templateDepth,
				templateStack: templateStack
			};
			
			// Template markers return ParseResult directly
			if (parser.isTemplateMarker) {
				return parser.parse(ctx);
			}
			
			// Regular type parsers return remaining string
			const remainingStr = parser.parse(ctx);
			
			if (remainingStr !== null && typeInfo.typeStr) {
				return new ParseResult(typeInfo, remainingStr, templateDepth, templateStack);
			}
		}
	}

	// Unknown type code - skip it
	return new ParseResult(null, remainingAfterQualifiers, templateDepth, templateStack);
}

/**
 * Serializes a list of types into a parameter list string with proper template handling
 * @param {Array} types - The array of type info objects
 * @returns {string} Formatted parameter list
 */
function serializeTypeList(types) {
	const result = [];
	let templateDepth = 0;

	for (let i = 0; i < types.length; i++) {
		const type = types[i];
		const prevType = i > 0 ? types[i - 1] : null;
		const formattedType = formatTypeInfo(type);

		// Determine if we need a separator before this type
		// Add separator when:
		// - Not the first item
		// - Not a template end marker (they just close with '>')
		// - Previous item was not a template start (we just opened with '<')
		const needsSeparator = i > 0 &&
			!type.templateEnd &&
			prevType &&
			!prevType.templateStart;

		if (needsSeparator) {
			result.push(", ");
		}

		// Track template nesting
		if (type.templateStart) {
			templateDepth++;
		}

		result.push(formattedType);

		if (type.templateEnd) {
			templateDepth--;
		}
	}

	return result.join('');
}

/**
 * Formats reference and pointer qualifiers
 * @param {Object} type - Type or template type object
 * @returns {string} Formatted qualifiers
 */
function formatReferenceAndPointers(type) {
	let result = "";
	if (type.isRef) result += "&";
	if (type.isRValueRef) result += "&&";
	result += "*".repeat(type.numPtr);
	return result;
}

/**
 * Formats a type info object into its string representation
 * @param {Object} typeInfo - The type info to format
 * @returns {string} Formatted type string
 */
function formatTypeInfo(typeInfo) {
	let result = "";

	if (typeInfo.isConst) result += "const ";
	if (typeInfo.isVolatile) result += "volatile ";

	result += typeInfo.typeStr;

	if (typeInfo.templateStart) result += "<";
	if (typeInfo.templateEnd) result += ">";

	if (!typeInfo.templateStart) {
		result += formatReferenceAndPointers(typeInfo);
		if (typeInfo.isRestrict) result += " __restrict";
	}

	if (typeInfo.templateType) {
		result += formatReferenceAndPointers(typeInfo.templateType);
	}

	return result;
}
