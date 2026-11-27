import { createContext, useContext, useEffect, useMemo, useState } from "react"

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light")

  useEffect(() => {
    const isDark = theme === "dark"
    document.documentElement.classList.toggle("dark", isDark)
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem("theme", theme)
    const themeColor = document.querySelector('meta[name="theme-color"]')
    themeColor?.setAttribute("content", isDark ? "#101311" : "#ffffff")
  }, [theme])

  function toggleTheme() {
    setTheme((currentTheme) => currentTheme === "light" ? "dark" : "light")
  }

  const value = useMemo(() => ({ theme, toggleTheme }), [theme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.")
  }

  return context
}
