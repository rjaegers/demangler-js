/**
 * Demangles C++ function names mangled according to the IA64 C++ ABI
 *
 * This is a pretentious and cocky way to say that this file demangles function names
 * mangled by GCC and Clang.
 *
 * Material used: https://itanium-cxx-abi.github.io/cxx-abi/abi.html#mangling
 */

/**
 * Parses a single name segment (length-prefixed)
 * @param {string} str - String starting with a length prefix
 * @returns {{segment: string, remaining: string}} Parsed segment info
 */
function parseNameSegment(str) {
	const lengthMatch = /(\d+)/.exec(str);
	if (!lengthMatch || !lengthMatch[0]) {
		return { segment: "", remaining: str };
	}
	
	const segmentLength = parseInt(lengthMatch[0], 10);
	const afterLength = str.slice(lengthMatch[0].length);
	let segment = afterLength.slice(0, segmentLength);
	
	// Handle anonymous namespace
	if (segment === "_GLOBAL__N_1") {
		segment = "(anonymous namespace)";
	}
	
	const remaining = afterLength.slice(segmentLength);
	
	return { segment, remaining };
}

/**
 * Checks if there are more segments to parse in a name
 * @param {string} str - The remaining string
 * @param {boolean} isEntity - Whether this is an entity (has 'E' terminator)
 * @returns {boolean} True if more segments follow
 */
function hasMoreSegments(str, isEntity) {
	if (!isEntity || !str.length) {
		return false;
	}
	
	const firstChar = str[0];
	return firstChar !== 'E' && firstChar !== 'I' && /\d/.test(firstChar);
}

/**
 * Removes a mangled name from 'remainingString', in the mangled name format
 * Returns an object with 'name' property (the name) and 'str' property (the remainder)
 * @param {string} remainingString - The mangled string to parse
 * @returns {{name: string, str: string}} Parsed name and remaining string
 */
function popName(remainingString) {
	// The name is in the format <length><str>
	let isLastSegment = false;
	let resultName = "";
	let isEntity = false;

	while (!isLastSegment) {
		isLastSegment = remainingString[0] !== "N";

		// St means std:: in the mangled string
		if (remainingString.slice(1, 3) === "St") {
			resultName += "std::";
			remainingString = remainingString.replace("St", "");
		}

		isEntity = isEntity || !isLastSegment;

		if (!isLastSegment) {
			remainingString = remainingString.slice(1); // Remove 'N'
		}
		
		// Parse one segment (length-prefixed name)
		const segmentResult = parseNameSegment(remainingString);
		if (segmentResult.segment) {
			resultName += segmentResult.segment;
			remainingString = segmentResult.remaining;

			// Check for template arguments in the name (I...E)
			const templateResult = parseTemplateIfPresent(remainingString, resultName);
			resultName = templateResult.name;
			remainingString = templateResult.str;
		}

		// Determine if more segments follow
		const moreSegments = hasMoreSegments(remainingString, isEntity);
		if (moreSegments) {
			resultName += "::";
		}
		isLastSegment = !moreSegments && (isEntity || isLastSegment);
	}

	if (isEntity && remainingString[0] === 'E') {
		remainingString = remainingString.slice(1);
	}

	return { name: resultName, str: remainingString };
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
		const argMatch = /(\d+)/.exec(remaining);
		if (!argMatch || !argMatch[0]) {
			break; // Not a length-prefixed name, stop parsing templates
		}
		
		const argLength = parseInt(argMatch[0], 10);
		const afterArgLength = remaining.slice(argMatch[0].length);
		const argName = afterArgLength.slice(0, argLength);
		
		templateArgs.push(argName);
		remaining = afterArgLength.slice(argLength);
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
 * Parses std:: abbreviated types (S-codes)
 * @param {string} str - String starting after 'S'
 * @returns {{typeStr: string, str: string}} Parsed type and remaining string
 */
function parseStdType(str) {
	const stdTypeMap = {
		'a': 'std::allocator',
		'b': 'std::basic_string',
		's': 'std::basic_string<char, std::char_traits<char>, std::allocator<char>>',
		'i': 'std::basic_istream<char, std::char_traits<char>>',
		'o': 'std::basic_ostream<char, std::char_traits<char>>',
		'd': 'std::basic_iostream<char, std::char_traits<char>>'
	};
	
	const firstChar = str[0];
	
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

	// Process the types
	const parseResult = parseTypeList(functionNameResult.str);
	const types = parseResult.types;

	// Serialize types with proper template context awareness
	const parameterList = serializeTypeList(types);
	const signature = functionName + "(" + parameterList + ")";
	
	return signature;
	}
};

/**
 * Parses the type list from the encoding
 * @param {string} encoding - The type encoding string
 * @returns {{types: Array}} Parsed types
 */
function parseTypeList(encoding) {
	const types = [];
	let remainingEncoding = encoding;
	let templateDepth = 0;
	let templateStack = [];

	while (remainingEncoding.length > 0) {
		const { typeInfo, remaining, templateDepth: newDepth, templateStack: newStack, skip } = parseSingleType(
			remainingEncoding,
			types,
			templateDepth,
			templateStack
		);
		
		if (typeInfo) {
			types.push(typeInfo);
		}
		
		remainingEncoding = remaining;
		templateDepth = newDepth;
		templateStack = newStack;
		
		if (skip) {
			continue;
		}
	}
	
	return { types };
}

/**
 * Parses a single type from the encoding
 * @param {string} encoding - The encoding string
 * @param {Array} types - Current types array
 * @param {number} templateDepth - Current template nesting depth
 * @param {Array} templateStack - Current template stack
 * @returns {Object} Parse result with typeInfo and remaining string
 */
function parseSingleType(encoding, types, templateDepth, templateStack) {
	let currentChar = encoding[0];
	let remainingEncoding = encoding.slice(1);

	const typeInfo = {
		isBase: true,
		typeStr: "",
		isConst: false,
		numPtr: 0,
		isRValueRef: false,
		isRef: false,
		isRestrict: false,
		templateStart: false,
		templateEnd: false,
		isVolatile: false,
		templateType: null
	};

	// Parse type qualifiers (const, ptr, ref...)
	const qualifierResult = parseTypeQualifiers(currentChar + remainingEncoding);
	Object.assign(typeInfo, qualifierResult.qualifiers);
	currentChar = qualifierResult.str[0];
	remainingEncoding = qualifierResult.str.slice(1);

	// Get the type code and process it
	const basicType = getBasicTypeName(currentChar);
	if (basicType) {
		typeInfo.typeStr = basicType;
		return { typeInfo, remaining: remainingEncoding, templateDepth, templateStack, skip: false };
	}
	
	if (currentChar === 'S') {
		// Abbreviated std:: types
		const stdResult = parseStdType(remainingEncoding);
		typeInfo.typeStr = stdResult.typeStr;
		return { typeInfo, remaining: stdResult.str, templateDepth, templateStack, skip: false };
	}
	
	if (currentChar === 'I') {
		// Template open bracket (<)
		if (types.length > 0) {
			types[types.length - 1].templateStart = true;
			templateStack.push(types[types.length - 1]);
		}
		return {
			typeInfo: null,
			remaining: remainingEncoding,
			templateDepth: templateDepth + 1,
			templateStack,
			skip: true
		};
	}
	
	if (currentChar === 'E') {
		// Template closing bracket (>)
		if (templateDepth <= 0) {
			return { typeInfo: null, remaining: remainingEncoding, templateDepth, templateStack, skip: true };
		}

		typeInfo.templateEnd = true;
		const newDepth = templateDepth - 1;
		typeInfo.templateType = templateStack[newDepth];
		const newStack = templateStack.slice(0, -1);
		return { typeInfo, remaining: remainingEncoding, templateDepth: newDepth, templateStack: newStack, skip: false };
	}
	
	if (!isNaN(parseInt(currentChar, 10)) || currentChar === "N") {
		// It's a custom type name
		const typeNameResult = popName(currentChar + remainingEncoding);
		typeInfo.typeStr = typeNameResult.name;
		return { typeInfo, remaining: typeNameResult.str, templateDepth, templateStack, skip: false };
	}
	
	return { typeInfo: null, remaining: remainingEncoding, templateDepth, templateStack, skip: true };
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
		if (typeInfo.isRef) result += "&";
		if (typeInfo.isRValueRef) result += "&&";
		for (let i = 0; i < typeInfo.numPtr; i++) result += "*";
		if (typeInfo.isRestrict) result += " __restrict";
	}

	if (typeInfo.templateType) {
		if (typeInfo.templateType.isRef) result += "&";
		if (typeInfo.templateType.isRValueRef) result += "&&";
		for (let i = 0; i < typeInfo.templateType.numPtr; i++) result += "*";
	}

	return result;
}
