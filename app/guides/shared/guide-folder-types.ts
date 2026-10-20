export type GuideFolderScope = 'mine' | 'saved'

export type GuideFolder = { id: string; name: string }

export type GuideFoldersSnapshot = {
  folders: GuideFolder[]
  // guide key ('guide:<id>' or 'deck:<id>') -> folder id
  assignments: Record<string, string>
}
