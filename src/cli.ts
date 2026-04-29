import { Command } from "commander";
import {
  DEFAULT_MODEL_KEY,
  getSupportedModelKeys,
} from "./constants/models.js";
import {
  renderInstallResult,
  runInstallUseCase,
} from "./install/install-use-case.js";
import {
  renderVerifyResult,
  runVerifyUseCase,
} from "./install/verify-use-case.js";

export function createProgram(): Command {
  const supportedModelKeys = getSupportedModelKeys().join(", ");
  const program = new Command();

  program
    .name("zeroclaw-setup")
    .description(
      "GonkaGate-backed ZeroClaw onboarding with audited v0.6.9 install and read-only verify flows.",
    )
    .showHelpAfterError()
    .option(
      "-m, --model <key>",
      `Curated GonkaGate model key (${supportedModelKeys})`,
      DEFAULT_MODEL_KEY,
    )
    .action(async (options: { model: string }) => {
      const result = await runInstallUseCase({ model: options.model });
      console.log(renderInstallResult(result));
    });

  program
    .command("verify")
    .description(
      "Read-only verification of the saved GonkaGate contract and active ZeroClaw runtime on audited v0.6.9.",
    )
    .action(async () => {
      const result = await runVerifyUseCase();
      console.log(renderVerifyResult(result));
    });

  return program;
}

export async function run(argv = process.argv): Promise<void> {
  await createProgram().parseAsync(argv);
}

if (process.argv[1]) {
  const isDirectExecution =
    import.meta.url === new URL(`file://${process.argv[1]}`).href;

  if (isDirectExecution) {
    run().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\nError: ${message}`);
      process.exitCode = 1;
    });
  }
}
