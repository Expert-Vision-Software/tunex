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
  /**
   * When true, skip the `docker pull` step in the executor and run against
   * the locally-cached image. Surfaced via the `--no-pull` CLI flag.
   */
  noPull?: boolean;
}