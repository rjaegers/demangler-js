const assert = require('assert');
const itanium_abi = require('./../src/itanium-abi');

/* It seems that you can't retrieve the return type from the demangled name */

describe('Free Functions', () => {
	it('receives an unmangled name', (done) => {
		assert.equal(itanium_abi.demangle("main(int, char**)"), "main(int, char**)");
		done();
	});

	it('receives nothing, return void', (done) => {
		assert.equal(itanium_abi.demangle("_Z7doThingv"), "doThing()");
		done();
	});

	it('receives boolean', (done) => {
		assert.equal(itanium_abi.demangle("_Z6isBoolb"), "isBool(bool)");
		done();
	});

	it('receives unsigned short', (done) => {
		assert.equal(itanium_abi.demangle("_Z7isShortt"), "isShort(unsigned short)");
		done();
	});

	it('receives short', (done) => {
		assert.equal(itanium_abi.demangle("_Z7isShorts"), "isShort(short)");
		done();
	});

	it('receives unsigned char', (done) => {
		assert.equal(itanium_abi.demangle("_Z6isCharh"), "isChar(unsigned char)");
		done();
	});

	it('receives signed char', (done) => {
		assert.equal(itanium_abi.demangle("_Z6isChara"), "isChar(signed char)");
		done();
	});

	it('receives wide char', (done) => {
		assert.equal(itanium_abi.demangle("_Z6isCharw"), "isChar(wchar_t)");
		done();
	});

	it('receives wide char pointer', (done) => {
		assert.equal(itanium_abi.demangle("_Z6isCharPw"), "isChar(wchar_t*)");
		done();
	});

	it('receives integer', (done) => {
		assert.equal(itanium_abi.demangle("_Z5isInti"), "isInt(int)");
		done();
	});

	it('receives long', (done) => {
		assert.equal(itanium_abi.demangle("_Z9test_longl"), "test_long(long)");
		done();
	});

	it('receives volatile pointer to long', (done) => {
		assert.equal(itanium_abi.demangle("_Z9dangerousPVl"), "dangerous(volatile long*)");
		done();
	});

	it('receives long long', (done) => {
		assert.equal(itanium_abi.demangle("_Z9test_longx"), "test_long(long long)");
		done();
	});

	it('receives unsigned int', (done) => {
		assert.equal(itanium_abi.demangle("_Z9test_uintj"), "test_uint(unsigned int)");
		done();
	});

	it('receives size_t', (done) => {
		assert.equal(itanium_abi.demangle("_Z10test_sizetm"), "test_sizet(unsigned long)");
		done();
	});

	it('receives signed size_t', (done) => {
		assert.equal(itanium_abi.demangle("_Z11test_ssizetl"), "test_ssizet(long)");
		done();
	});

	it('receives double', (done) => {
		assert.equal(itanium_abi.demangle("_Z5isIntd"), "isInt(double)");
		done();
	});

	it('receives double+int', (done) => {
		assert.equal(itanium_abi.demangle("_Z5isIntdi"), "isInt(double, int)");
		done();
	});

	it('receives const char ptr', (done) => {
		assert.equal(itanium_abi.demangle("_Z13testConstCharPKc"), "testConstChar(const char*)");
		done();
	});

	it('receives const restrict char ptrs', (done) => {
		assert.equal(itanium_abi.demangle("_Z6strcpyPrKcPrc"),
			"strcpy(const char* restrict, char* restrict)");
		done();
	});

	it('receives double char ptr', (done) => {
		assert.equal(itanium_abi.demangle("_Z11testCharPtrPPc"), "testCharPtr(char**)");
		done();
	});

	it('receives char ptr', (done) => {
		assert.equal(itanium_abi.demangle("_Z11testCharPtrPc"), "testCharPtr(char*)");
		done();
	});

	it('receives reference to an int', (done) => {
		assert.equal(itanium_abi.demangle("_Z16testIntReferenceRi"), "testIntReference(int&)");
		done();
	});

	it('receives reference to an int and a double', (done) => {
		assert.equal(itanium_abi.demangle("_Z16testIntReferenceRid"),
			"testIntReference(int&, double)");
		done();
	});

	it('receives a custom struct', (done) => {
		assert.equal(itanium_abi.demangle("_Z16testCustomStruct11test_struct"),
			"testCustomStruct(test_struct)");
		done();
	});

	it('receives a pointer to a custom struct', (done) => {
		assert.equal(itanium_abi.demangle("_Z16testCustomStructP11test_struct"),
			"testCustomStruct(test_struct*)");
		done();
	});

	it('receives a reference to a custom struct', (done) => {
		assert.equal(itanium_abi.demangle("_Z16testCustomStructR11test_struct"),
			"testCustomStruct(test_struct&)");
		done();
	});

	it('receives a custom struct and an int', (done) => {
		assert.equal(itanium_abi.demangle("_Z16testCustomStruct11test_structi"),
			"testCustomStruct(test_struct, int)");
		done();
	});
});

describe('classes', () => {
	it('public function, receives nothing', (done) => {
		assert.equal(itanium_abi.demangle("_ZN10test_class4testEv"), "test_class::test()");
		done();
	});

	it('public function, receives an integer', (done) => {
		assert.equal(itanium_abi.demangle("_ZN10test_class4testEi"), "test_class::test(int)");
		done();
	});

	it('private function, receives nothing', (done) => {
		assert.equal(itanium_abi.demangle("_ZN10test_class12test_privateEv"),
			"test_class::test_private()");
		done();
	});

	it('private function, receives an integer', (done) => {
		assert.equal(itanium_abi.demangle("_ZN10test_class12test_privateEi"),
			"test_class::test_private(int)");
		done();
	});

	it('free function, receives a class', (done) => {
		assert.equal(itanium_abi.demangle("_Z21function_return_class10test_class"),
			"function_return_class(test_class)");
		done();
	});

	it('free function, receives a class ref', (done) => {
		assert.equal(itanium_abi.demangle("_Z21function_return_classR10test_class"),
			"function_return_class(test_class&)");
		done();
	});

	it('free function, receives a class ptr', (done) => {
		assert.equal(itanium_abi.demangle("_Z21function_return_classP10test_class"),
			"function_return_class(test_class*)");
		done();
	});
});

describe('namespaces', () => {
	it('receives integer', (done) => {
		assert.equal(itanium_abi.demangle("_ZN4test14testNamespacedEi"), "test::testNamespaced(int)");
		done();
	});

	it('receives integer and a struct within another namespace', (done) => {
		assert.equal(itanium_abi.demangle("_ZN4test14testNamespacedEiN9othertest10teststructE"),
			"test::testNamespaced(int, othertest::teststruct)");
		done();
	});

	it('receives integer and a reference to a struct within another namespace', (done) => {
		assert.equal(itanium_abi.demangle("_ZN4test14testNamespacedEiRN9othertest10teststructE"),
			"test::testNamespaced(int, othertest::teststruct&)");
		done();
	});
});

describe('std types', () => {
	it('receives std::string', (done) => {
		assert.equal(itanium_abi.demangle(
			"_Z10testStringNSt7__cxx1112basic_stringIcSt11char_traitsIcESaIcEEE"),
			"testString(std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char>>)");
		done();
	});

	it('receives std::string ref', (done) => {
		assert.equal(itanium_abi.demangle(
			"_Z10testStringRNSt7__cxx1112basic_stringIcSt11char_traitsIcESaIcEEE"),
			"testString(std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char>>&)");
		done();
	});

	it('receives std::string rvalue', (done) => {
		assert.equal(itanium_abi.demangle(
			"_Z18test_rvalue_stringONSt7__cxx1112basic_stringIcSt11char_traitsIcESaIcEEE"),
			"test_rvalue_string(std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char>>&&)");
		done();
	});

	it('receives std::vector<int>', (done) => {
		assert.equal(itanium_abi.demangle(
			"_Z10testVectorSt6vectorIiSaIiEE"), "testVector(std::vector<int, std::allocator<int>>)");
		done();
	});

	it('receives std::queue<float>', (done) => {
		assert.equal(itanium_abi.demangle(
			"_Z10test_queueSt5queueIfSt5dequeIfSaIfEEE"),
			"test_queue(std::queue<float, std::deque<float, std::allocator<float>>>)");
		done();
	});
});

describe('numeric types', () => {
	it('receives float', (done) => {
		assert.equal(itanium_abi.demangle("_Z9testFloatf"), "testFloat(float)");
		done();
	});

	it('receives long double', (done) => {
		assert.equal(itanium_abi.demangle("_Z14testLongDoublee"), "testLongDouble(long double)");
		done();
	});

	it('receives __int128', (done) => {
		assert.equal(itanium_abi.demangle("_Z10testInt128n"), "testInt128(__int128)");
		done();
	});

	it('receives unsigned __int128', (done) => {
		assert.equal(itanium_abi.demangle("_Z11testUInt128o"), "testUInt128(unsigned __int128)");
		done();
	});

	it('receives __float128', (done) => {
		assert.equal(itanium_abi.demangle("_Z12testFloat128g"), "testFloat128(__float128)");
		done();
	});

	it('receives unsigned long long', (done) => {
		assert.equal(itanium_abi.demangle("_Z8testULLIy"), "testULLI(unsigned long long)");
		done();
	});
});

describe('qualifiers and modifiers', () => {
	it('receives const int', (done) => {
		assert.equal(itanium_abi.demangle("_Z12testConstIntKi"), "testConstInt(const int)");
		done();
	});

	it('receives volatile int', (done) => {
		assert.equal(itanium_abi.demangle("_Z15testVolatileIntVi"), "testVolatileInt(volatile int)");
		done();
	});

	it('receives const volatile int', (done) => {
		assert.equal(itanium_abi.demangle("_Z20testConstVolatileIntVKi"), "testConstVolatileInt(const volatile int)");
		done();
	});

	it('receives rvalue reference to int', (done) => {
		assert.equal(itanium_abi.demangle("_Z16testRvalueRefIntOi"), "testRvalueRefInt(int&&)");
		done();
	});

	it('receives multiple pointers', (done) => {
		assert.equal(itanium_abi.demangle("_Z13testTriplePtrPPPi"), "testTriplePtr(int***)")
		done();
	});

	it('receives pointer to const int', (done) => {
		assert.equal(itanium_abi.demangle("_Z14testPtrToConstPKi"), "testPtrToConst(const int*)");
		done();
	});
});

describe('std abbreviated types', () => {
	it('receives std::allocator', (done) => {
		assert.equal(itanium_abi.demangle("_Z13testAllocatorSaIiE"), "testAllocator(std::allocator<int>)");
		done();
	});

	it('receives std::basic_string', (done) => {
		assert.equal(itanium_abi.demangle("_Z15testBasicStringSbIwE"), "testBasicString(std::basic_string<wchar_t>)");
		done();
	});

	it('receives std::basic_istream', (done) => {
		assert.equal(itanium_abi.demangle("_Z11testIstreamSi"), "testIstream(std::basic_istream<char, std::char_traits<char>>)");
		done();
	});

	it('receives std::basic_ostream', (done) => {
		assert.equal(itanium_abi.demangle("_Z11testOstreamSo"), "testOstream(std::basic_ostream<char, std::char_traits<char>>)");
		done();
	});

	it('receives std::basic_iostream', (done) => {
		assert.equal(itanium_abi.demangle("_Z12testIostreamSd"), "testIostream(std::basic_iostream<char, std::char_traits<char>>)");
		done();
	});

	it('receives std::string (abbreviated)', (done) => {
		assert.equal(itanium_abi.demangle("_Z10testStringSs"), "testString(std::basic_string<char, std::char_traits<char>, std::allocator<char>>)");
		done();
	});
});

describe('variadic functions', () => {
	it('receives variadic arguments', (done) => {
		assert.equal(itanium_abi.demangle("_Z6printfPKcz"), "printf(const char*, ...)");
		done();
	});
});

describe('multiple parameters', () => {
	it('receives multiple types mixed', (done) => {
		assert.equal(itanium_abi.demangle("_Z11mixedParamsibfdPKc"), 
			"mixedParams(int, bool, float, double, const char*)");
		done();
	});

	it('receives pointers and references mixed', (done) => {
		assert.equal(itanium_abi.demangle("_Z9mixedModsPiRiOi"), 
			"mixedMods(int*, int&, int&&)");
		done();
	});
});

describe('nested namespaces', () => {
	it('handles deeply nested namespaces', (done) => {
		assert.equal(itanium_abi.demangle("_ZN5outer5inner4deep8functionEv"), 
			"outer::inner::deep::function()");
		done();
	});

	it('handles namespace with custom type', (done) => {
		assert.equal(itanium_abi.demangle("_ZN2ns8functionEN4data6customE"), 
			"ns::function(data::custom)");
		done();
	});
});

describe('operator overloading', () => {
	describe('arithmetic operators', () => {
		it('handles operator+', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberplERKS_"), "Number::operator+(const Number&)");
			done();
		});

		it('handles operator-', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumbermiERKS_"), "Number::operator-(const Number&)");
			done();
		});

		it('handles operator*', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumbermlERKS_"), "Number::operator*(const Number&)");
			done();
		});

		it('handles operator/', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberdvERKS_"), "Number::operator/(const Number&)");
			done();
		});

		it('handles operator%', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberrmERKS_"), "Number::operator%(const Number&)");
			done();
		});
	});

	describe('comparison operators', () => {
		it('handles operator==', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumbereqERKS_"), "Number::operator==(const Number&)");
			done();
		});

		it('handles operator!=', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberneERKS_"), "Number::operator!=(const Number&)");
			done();
		});

		it('handles operator<', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberltERKS_"), "Number::operator<(const Number&)");
			done();
		});

		it('handles operator>', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumbergtERKS_"), "Number::operator>(const Number&)");
			done();
		});

		it('handles operator<=', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberleERKS_"), "Number::operator<=(const Number&)");
			done();
		});

		it('handles operator>=', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumbergeERKS_"), "Number::operator>=(const Number&)");
			done();
		});

		it('handles operator<=> (spaceship)', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberssERKS_"), "Number::operator<=>(const Number&)");
			done();
		});
	});

	describe('assignment operators', () => {
		it('handles operator=', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberaSERKS_"), "Number::operator=(const Number&)");
			done();
		});

		it('handles operator+=', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberpLERKS_"), "Number::operator+=(const Number&)");
			done();
		});

		it('handles operator-=', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumbermIERKS_"), "Number::operator-=(const Number&)");
			done();
		});

		it('handles operator*=', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumbermLERKS_"), "Number::operator*=(const Number&)");
			done();
		});

		it('handles operator/=', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberdVERKS_"), "Number::operator/=(const Number&)");
			done();
		});

		it('handles operator%=', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberrMERKS_"), "Number::operator%=(const Number&)");
			done();
		});
	});

	describe('bitwise operators', () => {
		it('handles operator&', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberanERKS_"), "Number::operator&(const Number&)");
			done();
		});

		it('handles operator|', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberorERKS_"), "Number::operator|(const Number&)");
			done();
		});

		it('handles operator^', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumbereoERKS_"), "Number::operator^(const Number&)");
			done();
		});

		it('handles operator~', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumbercoEv"), "Number::operator~()");
			done();
		});

		it('handles operator<<', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberlsERKS_"), "Number::operator<<(const Number&)");
			done();
		});

		it('handles operator>>', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberrsERKS_"), "Number::operator>>(const Number&)");
			done();
		});

		it('handles operator&=', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberaNERKS_"), "Number::operator&=(const Number&)");
			done();
		});

		it('handles operator|=', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberoRERKS_"), "Number::operator|=(const Number&)");
			done();
		});

		it('handles operator^=', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumbereOERKS_"), "Number::operator^=(const Number&)");
			done();
		});

		it('handles operator<<=', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberlSERKS_"), "Number::operator<<=(const Number&)");
			done();
		});

		it('handles operator>>=', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberrSERKS_"), "Number::operator>>=(const Number&)");
			done();
		});
	});

	describe('logical and increment operators', () => {
		it('handles operator!', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberntEv"), "Number::operator!()");
			done();
		});

		it('handles operator&&', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberaaERKS_"), "Number::operator&&(const Number&)");
			done();
		});

		it('handles operator||', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberooERKS_"), "Number::operator||(const Number&)");
			done();
		});

		it('handles operator++', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberppEv"), "Number::operator++()");
			done();
		});

		it('handles operator--', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumbermmEv"), "Number::operator--()");
			done();
		});
	});

	describe('special operators', () => {
		it('handles operator()', (done) => {
			assert.equal(itanium_abi.demangle("_ZN7FunctorclEi"), "Functor::operator()(int)");
			done();
		});

		it('handles operator[]', (done) => {
			assert.equal(itanium_abi.demangle("_ZN5ArrayixEi"), "Array::operator[](int)");
			done();
		});

		it('handles operator->', (done) => {
			assert.equal(itanium_abi.demangle("_ZN7PointerptEv"), "Pointer::operator->()");
			done();
		});

		it('handles operator->*', (done) => {
			assert.equal(itanium_abi.demangle("_ZN7PointerpmEi"), "Pointer::operator->*(int)");
			done();
		});

		it('handles operator,', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumbercmERKS_"), "Number::operator,(const Number&)");
			done();
		});
	});

	describe('memory operators', () => {
		it('handles operator new', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6ObjectnwEm"), "Object::operator new(unsigned long)");
			done();
		});

		it('handles operator new[]', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6ObjectnaEm"), "Object::operator new[](unsigned long)");
			done();
		});

		it('handles operator delete', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6ObjectdlEPv"), "Object::operator delete(void*)");
			done();
		});

		it('handles operator delete[]', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6ObjectdaEPv"), "Object::operator delete[](void*)");
			done();
		});
	});

	describe('unary operators', () => {
		it('handles unary operator+', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberpsEv"), "Number::operator+()");
			done();
		});

		it('handles unary operator-', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberngEv"), "Number::operator-()");
			done();
		});

		it('handles unary operator& (address-of)', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberadEv"), "Number::operator&()");
			done();
		});

		it('handles unary operator* (dereference)', (done) => {
			assert.equal(itanium_abi.demangle("_ZN7PointerdeEv"), "Pointer::operator*()");
			done();
		});
	});
});

describe('constructors and destructors', () => {
	it('handles constructor', (done) => {
		assert.equal(itanium_abi.demangle("_ZN6VectorC1Ev"), "Vector::Vector()");
		done();
	});

	it('handles constructor with parameters', (done) => {
		assert.equal(itanium_abi.demangle("_ZN6VectorC1Eii"), "Vector::Vector(int, int)");
		done();
	});

	it('handles destructor', (done) => {
		assert.equal(itanium_abi.demangle("_ZN6VectorD1Ev"), "Vector::~Vector()");
		done();
	});

	it('handles copy constructor', (done) => {
		assert.equal(itanium_abi.demangle("_ZN6VectorC1ERKS_"), "Vector::Vector(const Vector&)");
		done();
	});
});

describe('const member functions', () => {
	it('handles const member function', (done) => {
		assert.equal(itanium_abi.demangle("_ZNK6Vector4sizeEv"), "Vector::size() const");
		done();
	});

	it('handles const member function with parameters', (done) => {
		assert.equal(itanium_abi.demangle("_ZNK6Vector2atEi"), "Vector::at(int) const");
		done();
	});
});

describe('static and const qualifiers', () => {
	it('handles pointer to pointer to const', (done) => {
		assert.equal(itanium_abi.demangle("_Z8testPtrsPPKi"), "testPtrs(const int**)");
		done();
	});
});

describe('template functions', () => {
	it('handles simple template function', (done) => {
		assert.equal(itanium_abi.demangle("_Z3maxIiET_S0_S0_"), "int max<int>(int, int)");
		done();
	});

	it('handles template with multiple types', (done) => {
		assert.equal(itanium_abi.demangle("_Z4swapIiEvRT_S1_"), "void swap<int>(int&, int&)");
		done();
	});

	it('handles complex templated member function', (done) => {
		assert.equal(itanium_abi.demangle("_ZN3std6vectorIiSaIiEE9push_backERKi"), "std::vector<int, std::allocator<int>>::push_back(const int&)");
		done();
	});
});

describe('array types', () => {
	it('handles simple array', (done) => {
		assert.equal(itanium_abi.demangle("_Z9testArrayA10_i"), "testArray(int[10])");
		done();
	});

	it('handles multidimensional arrays', (done) => {
		assert.equal(itanium_abi.demangle("_Z11test2DArrayA10_A20_i"), "test2DArray(int[10][20])");
		done();
	});
});

describe('function pointers', () => {
	it('handles function pointer parameter', (done) => {
		assert.equal(itanium_abi.demangle("_Z8callbackPFviE"), "callback(void (*)(int))");
		done();
	});

	it('handles pointer to member function', (done) => {
		assert.equal(itanium_abi.demangle("_Z10testMemberiM6VectorKFvvE"), "testMember(int, void (Vector::*)() const)");
		done();
	});
});

describe('complex substitutions', () => {
	it('handles multiple back-references', (done) => {
		assert.equal(itanium_abi.demangle("_Z8functionN3foo3barES0_S0_"), "function(foo::bar, foo::bar, foo::bar)");
		done();
	});

	it('handles nested type substitutions', (done) => {
		assert.equal(itanium_abi.demangle("_ZN6Vector4pushERKS_"), "Vector::push(const Vector&)");
		done();
	});
});

describe('edge cases', () => {
	it('handles isMangled check for non-mangled name', (done) => {
		assert.equal(itanium_abi.isMangled("regularFunction"), false);
		done();
	});

	it('handles isMangled check for mangled name', (done) => {
		assert.equal(itanium_abi.isMangled("_Z5isInti"), true);
		done();
	});

	it('demangles templated type in anonymous namespace', (done) => {
		assert.equal(itanium_abi.demangle("_ZN12_GLOBAL__N_128gtest_suite_PrimeTableTest2_24ReturnsFalseForNonPrimesI18OnTheFlyPrimeTableE8TestBodyEv"), "(anonymous namespace)::gtest_suite_PrimeTableTest2_::ReturnsFalseForNonPrimes<OnTheFlyPrimeTable>::TestBody()");
		done();
	});

	it('handles vendor-specific suffix with dot', (done) => {
		assert.equal(itanium_abi.demangle("_Z5isInti.constprop.0"), "isInt(int)");
		done();
	});

	it('handles empty parameter list explicitly', (done) => {
		assert.equal(itanium_abi.demangle("_Z8functionv"), "function()");
		done();
	});

	it('handles very long names', (done) => {
		assert.equal(itanium_abi.demangle("_Z49thisIsAVeryLongFunctionNameWithManyCharactersInItv"), 
			"thisIsAVeryLongFunctionNameWithManyCharactersInIt()");
		done();
	});
});

describe('error handling and edge cases', () => {
	it('handles malformed nested namespace', (done) => {
		// This tests the error path when namespace parsing encounters unexpected end
		assert.equal(itanium_abi.demangle("_ZN"), "()");
		done();
	});

	it('handles empty segment in namespace', (done) => {
		// Tests parseSegmentWithTemplate when segment is null (empty namespace)
		assert.equal(itanium_abi.demangle("_ZNE"), "()");
		done();
	});

	it('handles invalid segment start character', (done) => {
		// Tests isValidSegmentStart failure path (treats as empty namespace)
		assert.equal(itanium_abi.demangle("_ZN#E"), "()");
		done();
	});

	it('handles template parameter with no params available', (done) => {
		// Tests parseTemplateParam when templateParams array is empty (returns empty, becomes void)
		assert.equal(itanium_abi.demangle("_Z3fooT_"), "foo()");
		done();
	});

	it('handles template parameter index out of bounds', (done) => {
		// Tests parseTemplateParam when index >= templateParams.length (returns empty, shown as _)
		assert.equal(itanium_abi.demangle("_Z3fooT9_"), "foo(_)");
		done();
	});

	it('handles unknown std type code', (done) => {
		// Tests parseStdType fallback for unknown code (returns variadic ...)
		assert.equal(itanium_abi.demangle("_Z3fooSz"), "foo(...)");
		done();
	});

	it('handles substitution with empty substitutions array', (done) => {
		// Tests parseStdType when substitutions is empty (returns empty string, becomes void)
		assert.equal(itanium_abi.demangle("_Z3fooS_"), "foo()");
		done();
	});

	it('handles substitution index out of bounds', (done) => {
		// Tests parseStdType when index >= substitutions.length (returns empty, shown as _)
		assert.equal(itanium_abi.demangle("_Z3fooS99_"), "foo(_)");
		done();
	});

	it('handles array type without valid element type', (done) => {
		// Tests parseArrayType early return when no valid typeInfo (returns empty, shown as _)
		assert.equal(itanium_abi.demangle("_Z3fooA5_"), "foo(_)");
		done();
	});

	it('handles function pointer without valid return type', (done) => {
		// Tests parseFunctionType early return when no returnType
		assert.equal(itanium_abi.demangle("_Z3fooPF"), "foo()");
		done();
	});

	it('handles member function pointer without class type', (done) => {
		// Tests parseMemberFunctionPointer early return when no classType
		assert.equal(itanium_abi.demangle("_Z3fooM"), "foo()");
		done();
	});

	it('handles member function pointer missing F marker', (done) => {
		// Tests parseMemberFunctionPointer when remaining[0] !== 'F' (parses Bar as regular type)
		assert.equal(itanium_abi.demangle("_Z3fooM3Bar"), "foo(Bar)");
		done();
	});

	it('handles member function pointer without return type', (done) => {
		// Tests parseMemberFunctionPointer when no returnType after F (parses Bar as regular type)
		assert.equal(itanium_abi.demangle("_Z3fooM3BarF"), "foo(Bar)");
		done();
	});

	it('handles unknown type code', (done) => {
		// Tests parseSingleType fallback for unknown type code
		assert.equal(itanium_abi.demangle("_Z3fooQ"), "foo()");
		done();
	});

	it('handles template type on TypeInfo', (done) => {
		// Tests TypeInfo.toString() with templateType (reference qualifiers on template)
		assert.equal(itanium_abi.demangle("_Z3fooRi"), "foo(int&)");
		done();
	});

	it('handles malformed operator code', (done) => {
		// Tests getOperatorName returning null - 'zz' is variadic and gets parsed as two 'z' (...)
		assert.equal(itanium_abi.demangle("_ZN3FoozzEv"), "Foo(..., ..., void)");
		done();
	});

	it('handles function pointer type', (done) => {
		// Tests parseFunctionType - PFi is function pointer returning int
		assert.equal(itanium_abi.demangle("_Z3fooPFiE"), "foo(int (*)())");
		done();
	});

	it('handles parseTemplateIfPresent with non-digit after I', (done) => {
		// Tests early return in parseTemplateIfPresent when next char is not a digit
		assert.equal(itanium_abi.demangle("_Z3fooIiE"), "foo<int>()");
		done();
	});

	it('handles std::string type code', (done) => {
		// Tests std::string abbreviated type (Ss)
		assert.equal(itanium_abi.demangle("_Z3fooSs"), "foo(std::basic_string<char, std::char_traits<char>, std::allocator<char>>)");
		done();
	});

	it('handles parseStdType with digit (std:: custom)', (done) => {
		// Tests parseStdType when firstChar is a digit
		assert.equal(itanium_abi.demangle("_Z3fooS6vector"), "foo(std::vector)");
		done();
	});

	it('explicitly encodes return type for template functions taking parameters', (done) => {
		assert.equal(itanium_abi.demangle("_Z5firstI3DuoEvS0_"), "void first<Duo>(Duo)");
		done();
	});

	it('explicitly encodes return type for template functions with no parameters', (done) => {
		assert.equal(itanium_abi.demangle("_Z3fooIiPFidEiEvv"), "void foo<int, int (*)(double), int>()");
		done();
	});

	it('handles pointers to member data', (done) => {
		assert.equal(itanium_abi.demangle("_Z3fooPM2ABi"), "foo(int AB::**)");
		done();
	});
});
