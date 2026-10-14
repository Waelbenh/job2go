import { createContext, useContext } from 'react'

/** The top bar's search text, shared with the Jobs page */
export const SearchContext = createContext('')
export const useSearch = () => useContext(SearchContext)
