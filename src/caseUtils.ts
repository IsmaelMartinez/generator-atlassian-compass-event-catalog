function toKebab(string: string) {
    return string
      .split('')
      .map((letter, index) => {
        const previousLetter = string[index - 1] || ''
        const currentLetter = letter
  
        if (isDigit(currentLetter) && !isDigit(previousLetter)) {
          return `-${currentLetter}`
        }
  
        if (!isCaps(currentLetter)) return currentLetter
  
        if (previousLetter === '') {
          return `${currentLetter.toLowerCase()}`
        }
  
        if (isCaps(previousLetter)) {
          return `${currentLetter.toLowerCase()}`
        }
  
        return `-${currentLetter.toLowerCase()}`
      })
      .join('')
      .trim()
      .replace(/[-_\s]+/g, '-')
  }

export function toSentence(sentence: string) {
    const interim = toKebab(sentence).replace(/-/g, ' ')
    return interim.slice(0, 1).toUpperCase() + interim.slice(1)
}

// Checks whether character is Uppercase.
// Crude version. Checks only A-Z.
function isCaps(char: string) {
    return /\p{Lu}/u.test(char);
  }
  
  // Checks whether character is digit.
  function isDigit(char: string) {
    return /[0-9]/.test(char);
  }