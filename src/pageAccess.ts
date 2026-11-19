/** Páginas gerenciáveis no RIVORA. Configurações é exclusiva do administrador. */
export const RIVORA_PAGE_NAMES = [
  'Visão geral',
  'Relatórios',
  'Tarefas',
  'Automações',
  'Fechamentos e Importações',
  'Responsáveis',
  'Retornos',
  'Análises',
  'CPH Frota Leve',
  'Histórico',
] as const

export type RivoraPage = typeof RIVORA_PAGE_NAMES[number]

export function isRivoraPage(value:unknown):value is RivoraPage {
  return typeof value==='string' && (RIVORA_PAGE_NAMES as readonly string[]).includes(value)
}

export function selectedPages(value:unknown):RivoraPage[] {
  if(!Array.isArray(value))return []
  const allowed=new Set(value.filter(isRivoraPage))
  return RIVORA_PAGE_NAMES.filter(page=>allowed.has(page))
}
