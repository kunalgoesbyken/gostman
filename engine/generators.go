package engine

import (
	"fmt"
	"math/rand/v2"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	isoLayout       = "2006-01-02T15:04:05.000Z"
	dateLayout      = "2006-01-02"
	digits          = "0123456789"
	upperLetters    = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	passwordLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	base58Letters   = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
	day             = 24 * time.Hour
	year            = 365 * day
)

var dynamicGenerators = buildGenerators()

func buildGenerators() map[string]func() string {
	generators := map[string]func() string{
		"$guid":                newGUID,
		"$uuid":                newGUID,
		"$timestamp":           func() string { return strconv.FormatInt(time.Now().Unix(), 10) },
		"$timestampMs":         func() string { return strconv.FormatInt(time.Now().UnixMilli(), 10) },
		"$isoTimestamp":        func() string { return time.Now().UTC().Format(isoLayout) },
		"$randomInt":           func() string { return strconv.Itoa(rand.IntN(defaultRandomLimit + 1)) },
		"$randomBoolean":       func() string { return strconv.FormatBool(rand.IntN(2) == 1) },
		"$randomHex":           func() string { return randomFrom(hexDigits, 16) },
		"$randomAlphaNumeric":  func() string { return randomFrom(alphaNumerics, 12) },
		"$randomFirstName":     func() string { return pick(firstNames) },
		"$randomLastName":      func() string { return pick(lastNames) },
		"$randomFullName":      func() string { return pick(firstNames) + " " + pick(lastNames) },
		"$randomUserName":      func() string { return strings.ToLower(pick(firstNames)) + strconv.Itoa(rand.IntN(1000)) },
		"$randomEmail":         randomEmail,
		"$randomWord":          func() string { return pick(words) },
		"$randomIP":            randomIPv4,
		"$randomColor":         randomHexColor,
		"$randomUUID":          newGUID,
		"$randomHexColor":      randomHexColor,
		"$randomColorName":     func() string { return pick(colorNames) },
		"$randomAbbreviation":  func() string { return pick(hackerAbbreviations) },
		"$randomIPV6":          randomIPv6,
		"$randomMACAddress":    randomMAC,
		"$randomPassword":      func() string { return randomFrom(passwordLetters, 15) },
		"$randomLocale":        func() string { return pick(sampleLocales) },
		"$randomUserAgent":     func() string { return pick(userAgents) },
		"$randomProtocol":      func() string { return pick(internetProtocols) },
		"$randomSemver":        func() string { return fmt.Sprintf("%d.%d.%d", rand.IntN(10), rand.IntN(20), rand.IntN(30)) },
		"$randomNamePrefix":    func() string { return pick(namePrefixes) },
		"$randomNameSuffix":    func() string { return pick(nameSuffixes) },
		"$randomJobArea":       func() string { return pick(jobAreas) },
		"$randomJobDescriptor": func() string { return pick(jobDescriptors) },
		"$randomJobType":       func() string { return pick(jobTypes) },
		"$randomJobTitle":      func() string { return pick(jobDescriptors) + " " + pick(jobAreas) + " " + pick(jobTypes) },
		"$randomPhoneNumber":   func() string { return phoneDigits(3) + "-" + randomFrom(digits, 3) + "-" + randomFrom(digits, 4) },
		"$randomPhoneNumberExt": func() string {
			return randomFrom(digits, 2) + "-" + phoneDigits(3) + "-" + randomFrom(digits, 3) + "-" + randomFrom(digits, 4)
		},
		"$randomCity":                  func() string { return pick(lastNames) + pick(citySuffixes) },
		"$randomStreetName":            randomStreetName,
		"$randomStreetAddress":         func() string { return strconv.Itoa(1+rand.IntN(99999)) + " " + randomStreetName() },
		"$randomZipCode":               func() string { return randomFrom(digits, 5) },
		"$randomState":                 func() string { return pick(states) },
		"$randomTimeZone":              func() string { return pick(timeZones) },
		"$randomCountry":               func() string { return countries[rand.IntN(len(countries))].name },
		"$randomCountryCode":           func() string { return countries[rand.IntN(len(countries))].code },
		"$randomLatitude":              func() string { return coordinate(90) },
		"$randomLongitude":             func() string { return coordinate(180) },
		"$randomAvatarImage":           func() string { return "https://avatars.githubusercontent.com/u/" + strconv.Itoa(1+rand.IntN(90000000)) },
		"$randomImageUrl":              func() string { return imageURL(pick(imageCategories)) },
		"$randomImageDataUri":          randomImageDataURI,
		"$randomBankAccount":           func() string { return randomFrom(digits, 8) },
		"$randomBankAccountName":       func() string { return pick(bankAccountNames) },
		"$randomCreditCardMask":        func() string { return randomFrom(digits, 4) },
		"$randomCreditCardNumber":      randomCardNumber,
		"$randomBankAccountBic":        randomBIC,
		"$randomBankAccountIban":       randomIBAN,
		"$randomTransactionType":       func() string { return pick(transactionTypes) },
		"$randomCurrencyCode":          func() string { return currencies[rand.IntN(len(currencies))].code },
		"$randomCurrencyName":          func() string { return currencies[rand.IntN(len(currencies))].name },
		"$randomCurrencySymbol":        func() string { return currencies[rand.IntN(len(currencies))].symbol },
		"$randomBitcoin":               func() string { return string("13"[rand.IntN(2)]) + randomFrom(base58Letters, 25+rand.IntN(9)) },
		"$randomCompanyName":           randomCompanyName,
		"$randomCompanySuffix":         func() string { return pick(companySuffixes) },
		"$randomBs":                    func() string { return pick(bsBuzzwords) + " " + pick(bsAdjectives) + " " + pick(bsNouns) },
		"$randomBsAdjective":           func() string { return pick(bsAdjectives) },
		"$randomBsBuzz":                func() string { return pick(bsBuzzwords) },
		"$randomBsNoun":                func() string { return pick(bsNouns) },
		"$randomCatchPhrase":           randomCatchPhrase,
		"$randomCatchPhraseAdjective":  func() string { return pick(catchPhraseAdjectives) },
		"$randomCatchPhraseDescriptor": func() string { return pick(catchPhraseDescriptors) },
		"$randomCatchPhraseNoun":       func() string { return pick(catchPhraseNouns) },
		"$randomDatabaseColumn":        func() string { return pick(databaseColumns) },
		"$randomDatabaseType":          func() string { return pick(databaseTypes) },
		"$randomDatabaseCollation":     func() string { return pick(databaseCollations) },
		"$randomDatabaseEngine":        func() string { return pick(databaseEngines) },
		"$randomDateFuture":            func() string { return shiftedTime(year) },
		"$randomDatePast":              func() string { return shiftedTime(-year) },
		"$randomDateRecent":            func() string { return shiftedTime(-day) },
		"$randomDateSoon":              func() string { return shiftedTime(day) },
		"$randomBirthdate":             randomBirthdate,
		"$randomWeekday":               func() string { return time.Weekday(rand.IntN(7)).String() },
		"$randomMonth":                 func() string { return time.Month(1 + rand.IntN(12)).String() },
		"$randomDomainName":            randomDomainName,
		"$randomDomainSuffix":          func() string { return pick(domainSuffixes) },
		"$randomDomainWord":            func() string { return strings.ToLower(pick(lastNames)) },
		"$randomExampleEmail":          randomEmail,
		"$randomUrl":                   func() string { return pick(internetProtocols) + "://" + randomDomainName() },
		"$randomFileName":              func() string { return randomFileName(allMediaTypes) },
		"$randomFileType":              func() string { return mediaFamily(randomMedia(allMediaTypes)) },
		"$randomFileExt":               func() string { return randomMedia(allMediaTypes).extension },
		"$randomCommonFileName":        func() string { return randomFileName(commonMediaTypes) },
		"$randomCommonFileType":        func() string { return mediaFamily(randomMedia(commonMediaTypes)) },
		"$randomCommonFileExt":         func() string { return randomMedia(commonMediaTypes).extension },
		"$randomFilePath":              func() string { return pick(directoryPaths) + "/" + randomFileName(commonMediaTypes) },
		"$randomDirectoryPath":         func() string { return pick(directoryPaths) },
		"$randomMimeType":              func() string { return randomMedia(allMediaTypes).mime },
		"$randomPrice":                 func() string { return fmt.Sprintf("%d.%02d", rand.IntN(1000), rand.IntN(100)) },
		"$randomProduct":               func() string { return pick(products) },
		"$randomProductAdjective":      func() string { return pick(productAdjectives) },
		"$randomProductMaterial":       func() string { return pick(productMaterials) },
		"$randomProductName":           func() string { return pick(productAdjectives) + " " + pick(productMaterials) + " " + pick(products) },
		"$randomDepartment":            func() string { return pick(departments) },
		"$randomNoun":                  func() string { return pick(hackerNouns) },
		"$randomVerb":                  func() string { return pick(hackerVerbs) },
		"$randomIngverb":               func() string { return pick(hackerIngverbs) },
		"$randomAdjective":             func() string { return pick(hackerAdjectives) },
		"$randomWords":                 func() string { return wordsFrom(words, 2+rand.IntN(3)) },
		"$randomPhrase":                randomPhrase,
		"$randomLoremWord":             func() string { return pick(loremWords) },
		"$randomLoremWords":            func() string { return wordsFrom(loremWords, 3) },
		"$randomLoremSentence":         loremSentence,
		"$randomLoremSentences":        func() string { return loremSentences(2 + rand.IntN(5)) },
		"$randomLoremParagraph":        loremParagraph,
		"$randomLoremParagraphs":       func() string { return loremParagraph() + " " + loremParagraph() + " " + loremParagraph() },
		"$randomLoremText":             func() string { return loremSentences(1 + rand.IntN(10)) },
		"$randomLoremSlug":             func() string { return strings.Join(strings.Fields(wordsFrom(loremWords, 3)), "-") },
		"$randomLoremLines":            func() string { return loremSentences(1 + rand.IntN(5)) },
	}
	for _, category := range imageCategories {
		generators["$random"+strings.ToUpper(category[:1])+category[1:]+"Image"] = func() string { return imageURL(category) }
	}
	return generators
}

func generatorOf(name string) (func() string, bool) {
	generate, ok := dynamicGenerators[builtIns.canonical(name)]
	return generate, ok
}

func randomHexColor() string {
	return "#" + randomFrom(hexDigits, 6)
}

func randomIPv4() string {
	return fmt.Sprintf("%d.%d.%d.%d", 1+rand.IntN(223), rand.IntN(256), rand.IntN(256), 1+rand.IntN(254))
}

func phoneDigits(length int) string {
	return string(digits[2+rand.IntN(8)]) + randomFrom(digits, length-1)
}

func coordinate(limit int) string {
	return strconv.FormatFloat((rand.Float64()*2-1)*float64(limit), 'f', 4, 64)
}

func shiftedTime(span time.Duration) string {
	offset := time.Duration(rand.Int64N(int64(absDuration(span)))) + time.Second
	if span < 0 {
		offset = -offset
	}
	return time.Now().UTC().Add(offset).Format(isoLayout)
}

func absDuration(span time.Duration) time.Duration {
	if span < 0 {
		return -span
	}
	return span
}

func randomBirthdate() string {
	age := 18 + rand.IntN(63)
	born := time.Now().UTC().AddDate(-age, 0, -rand.IntN(365))
	return born.Format(dateLayout)
}

func randomIPv6() string {
	groups := make([]string, 8)
	for i := range groups {
		groups[i] = randomFrom(hexDigits, 4)
	}
	return strings.Join(groups, ":")
}

func randomMAC() string {
	pairs := make([]string, 6)
	for i := range pairs {
		pairs[i] = randomFrom(hexDigits, 2)
	}
	return strings.Join(pairs, ":")
}

func randomStreetName() string {
	return pick(lastNames) + " " + pick(streetSuffixes)
}

func randomDomainName() string {
	return strings.ToLower(pick(lastNames)) + "." + pick(domainSuffixes)
}

func randomCompanyName() string {
	switch rand.IntN(3) {
	case 0:
		return pick(lastNames) + " " + pick(companySuffixes)
	case 1:
		return pick(lastNames) + "-" + pick(lastNames)
	default:
		return pick(lastNames) + ", " + pick(lastNames) + " and " + pick(lastNames)
	}
}

func randomCatchPhrase() string {
	return pick(catchPhraseAdjectives) + " " + pick(catchPhraseDescriptors) + " " + pick(catchPhraseNouns)
}

func randomPhrase() string {
	templates := []string{
		"If we %[2]s the %[3]s, we can get to the %[1]s %[3]s through the %[4]s %[1]s %[5]s!",
		"We need to %[2]s the %[4]s %[1]s %[3]s!",
		"Try to %[2]s the %[1]s %[3]s, maybe it will %[2]s the %[4]s %[5]s!",
		"You can't %[2]s the %[3]s without %[6]s the %[4]s %[1]s %[5]s!",
		"The %[1]s %[3]s is down, %[2]s the %[4]s %[5]s so we can %[2]s the %[1]s %[3]s!",
	}
	return fmt.Sprintf(pick(templates), pick(hackerAbbreviations), pick(hackerVerbs), pick(hackerNouns), pick(hackerAdjectives), pick(hackerNouns), pick(hackerIngverbs))
}

func imageURL(category string) string {
	return fmt.Sprintf("https://picsum.photos/seed/%s-%d/640/480", category, rand.IntN(100000))
}

func randomImageDataURI() string {
	svg := fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="640" height="480"><rect width="100%%" height="100%%" fill="#%s"/></svg>`, randomFrom(hexDigits, 6))
	return "data:image/svg+xml;charset=UTF-8," + url.PathEscape(svg)
}

func randomMedia(options []mediaType) mediaType {
	return options[rand.IntN(len(options))]
}

func mediaFamily(media mediaType) string {
	family, _, _ := strings.Cut(media.mime, "/")
	return family
}

func randomFileName(options []mediaType) string {
	return pick(words) + "_" + pick(words) + "." + randomMedia(options).extension
}

func wordsFrom(options []string, count int) string {
	chosen := make([]string, count)
	for i := range chosen {
		chosen[i] = pick(options)
	}
	return strings.Join(chosen, " ")
}

func loremSentence() string {
	sentence := wordsFrom(loremWords, 4+rand.IntN(7))
	return strings.ToUpper(sentence[:1]) + sentence[1:] + "."
}

func loremSentences(count int) string {
	sentences := make([]string, count)
	for i := range sentences {
		sentences[i] = loremSentence()
	}
	return strings.Join(sentences, " ")
}

func loremParagraph() string {
	return loremSentences(3 + rand.IntN(4))
}

func randomBIC() string {
	return randomFrom(upperLetters, 4) + countries[rand.IntN(len(countries))].code + randomFrom(upperLetters+digits, 2)
}

func randomIBAN() string {
	layout := ibanLayouts[rand.IntN(len(ibanLayouts))]
	bban := randomFrom(upperLetters, layout.letters) + randomFrom(digits, layout.digits)
	return layout.country + fmt.Sprintf("%02d", 98-ibanRemainder(bban+layout.country+"00")) + bban
}

func ibanRemainder(text string) int {
	remainder := 0
	for _, char := range text {
		value := int(char - '0')
		if char >= 'A' && char <= 'Z' {
			value = int(char-'A') + 10
			remainder = remainder * 10 % 97
		}
		remainder = (remainder*10 + value) % 97
	}
	return remainder
}

func randomCardNumber() string {
	body := "4" + randomFrom(digits, 14)
	return body + strconv.Itoa(luhnCheckDigit(body))
}

func luhnCheckDigit(body string) int {
	sum := 0
	for i := len(body) - 1; i >= 0; i-- {
		value := int(body[i] - '0')
		if (len(body)-1-i)%2 == 0 {
			value *= 2
			if value > 9 {
				value -= 9
			}
		}
		sum += value
	}
	return (10 - sum%10) % 10
}
