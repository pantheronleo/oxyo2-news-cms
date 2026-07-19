declare module '@toast-ui/editor' {
  export default class Editor {
    constructor(options: Record<string, unknown>)
    on(event: string, handler: () => void): void
    getMarkdown(): string
    getHTML(): string
    setMarkdown(value: string): void
    destroy(): void
  }
}
