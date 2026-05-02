export interface YtubeCommand {
  name: string;
  description: string;
  execute(opts: CommandOptions): Promise<void>;
}

export interface CommandOptions {
  input: string | string[];
  outputDir?: string;
  threads?: number;
  continueOnError?: boolean;
  flatten?: boolean;
}