/* Test the itanium abi compatibility */

const assert = require('assert');
const itanium_abi = require('./../src/itanium-abi');

/* It seems that you can't retrieve the return type from the demangled name */

describe('Free Functions', () => {
	it('receives an unmangled name', (done) => {
		assert.equal(itanium_abi.demangle("main(int, char**)"), "main(int, char**)");
		done();
	});

	it('receives nothing, return void', (done) => {
		assert.equal(itanium_abi.demangle("_Z7doThingv"), "doThing(void)");
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

	it('receives long int', (done) => {
		assert.equal(itanium_abi.demangle("_Z9test_longl"), "test_long(long int)");
		done();
	});

	it('receives volatile pointer to long int', (done) => {
		assert.equal(itanium_abi.demangle("_Z9dangerousPVl"), "dangerous(volatile long int*)");
		done();
	});

	it('receives long long int', (done) => {
		assert.equal(itanium_abi.demangle("_Z9test_longx"), "test_long(long long int)");
		done();
	});

	it('receives unsigned int', (done) => {
		assert.equal(itanium_abi.demangle("_Z9test_uintj"), "test_uint(unsigned int)");
		done();
	});

	it('receives size_t', (done) => {
		assert.equal(itanium_abi.demangle("_Z10test_sizetm"), "test_sizet(unsigned long int)");
		done();
	});

	it('receives signed size_t', (done) => {
		assert.equal(itanium_abi.demangle("_Z11test_ssizetl"), "test_ssizet(long int)");
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
			"strcpy(const char* __restrict, char* __restrict)");
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
		assert.equal(itanium_abi.demangle("_ZN10test_class4testEv"), "test_class::test(void)");
		done();
	});

	it('public function, receives an integer', (done) => {
		assert.equal(itanium_abi.demangle("_ZN10test_class4testEi"), "test_class::test(int)");
		done();
	});

	it('private function, receives nothing', (done) => {
		assert.equal(itanium_abi.demangle("_ZN10test_class12test_privateEv"),
			"test_class::test_private(void)");
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

describe('complex types', () => {
	it('demangles templated type in anonymous namespace', (done) => {
		assert.equal(itanium_abi.demangle("_ZN12_GLOBAL__N_128gtest_suite_PrimeTableTest2_24ReturnsFalseForNonPrimesI18OnTheFlyPrimeTableE8TestBodyEv"), "(anonymous namespace)::gtest_suite_PrimeTableTest2_::ReturnsFalseForNonPrimes<OnTheFlyPrimeTable>::TestBody(void)");
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

	it('receives unsigned long long int', (done) => {
		assert.equal(itanium_abi.demangle("_Z8testULLIy"), "testULLI(unsigned long long int)");
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
			"outer::inner::deep::function(void)");
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
			assert.equal(itanium_abi.demangle("_ZN6NumbercoEv"), "Number::operator~(void)");
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
			assert.equal(itanium_abi.demangle("_ZN6NumberntEv"), "Number::operator!(void)");
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
			assert.equal(itanium_abi.demangle("_ZN6NumberppEv"), "Number::operator++(void)");
			done();
		});

		it('handles operator--', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumbermmEv"), "Number::operator--(void)");
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
			assert.equal(itanium_abi.demangle("_ZN7PointerptEv"), "Pointer::operator->(void)");
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
			assert.equal(itanium_abi.demangle("_ZN6ObjectnwEm"), "Object::operator new(unsigned long int)");
			done();
		});

		it('handles operator new[]', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6ObjectnaEm"), "Object::operator new[](unsigned long int)");
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
			assert.equal(itanium_abi.demangle("_ZN6NumberpsEv"), "Number::operator+(void)");
			done();
		});

		it('handles unary operator-', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberngEv"), "Number::operator-(void)");
			done();
		});

		it('handles unary operator& (address-of)', (done) => {
			assert.equal(itanium_abi.demangle("_ZN6NumberadEv"), "Number::operator&(void)");
			done();
		});

		it('handles unary operator* (dereference)', (done) => {
			assert.equal(itanium_abi.demangle("_ZN7PointerdeEv"), "Pointer::operator*(void)");
			done();
		});
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

	it('handles vendor-specific suffix with dot', (done) => {
		// Name with vendor suffix should be handled (suffix ignored)
		assert.equal(itanium_abi.demangle("_Z5isInti.constprop.0"), "isInt(int)");
		done();
	});
});
