/**
 * Converts a numeric amount to Indian Currency Words (Lakhs & Crores).
 * Example: 859040 => "Rupees Eight Lakh Fifty Nine Thousand Forty Only"
 */
export function numberToIndianWords(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return "Rupees Zero Only";
  }

  const rounded = Math.round(amount * 100) / 100;
  const parts = rounded.toString().split(".");
  const integerPart = parseInt(parts[0], 10);
  const decimalPart = parts[1] ? parseInt(parts[1].padEnd(2, "0").substring(0, 2), 10) : 0;

  if (integerPart === 0 && decimalPart === 0) {
    return "Rupees Zero Only";
  }

  const singleDigits = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];

  const tensDigits = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
  ];

  function convertTwoDigits(n: number): string {
    if (n < 20) return singleDigits[n];
    const tens = Math.floor(n / 10);
    const units = n % 10;
    return `${tensDigits[tens]}${units ? " " + singleDigits[units] : ""}`;
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let str = "";
    if (hundred > 0) {
      str += `${singleDigits[hundred]} Hundred`;
    }
    if (rest > 0) {
      str += `${str ? " " : ""}${convertTwoDigits(rest)}`;
    }
    return str;
  }

  function convertNumber(num: number): string {
    if (num === 0) return "Zero";

    const crore = Math.floor(num / 10000000);
    let rem = num % 10000000;

    const lakh = Math.floor(rem / 100000);
    rem = rem % 100000;

    const thousand = Math.floor(rem / 1000);
    rem = rem % 1000;

    const hundredStr = convertThreeDigits(rem);

    let result = "";

    if (crore > 0) {
      result += `${convertNumber(crore)} Crore`;
    }
    if (lakh > 0) {
      result += `${result ? " " : ""}${convertTwoDigits(lakh)} Lakh`;
    }
    if (thousand > 0) {
      result += `${result ? " " : ""}${convertTwoDigits(thousand)} Thousand`;
    }
    if (hundredStr) {
      result += `${result ? " " : ""}${hundredStr}`;
    }

    return result;
  }

  const rupeesWords = convertNumber(integerPart);
  let finalResult = `Rupees ${rupeesWords || "Zero"}`;

  if (decimalPart > 0) {
    const paiseWords = convertTwoDigits(decimalPart);
    finalResult += ` and ${paiseWords} Paise`;
  }

  finalResult += " Only";
  return finalResult;
}
