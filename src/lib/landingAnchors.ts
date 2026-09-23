export const LANDING_HOW_IT_WORKS_ID = 'как-это-работает'

export function scrollToLandingSection(elementId: string) {
  document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
