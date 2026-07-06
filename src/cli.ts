import { Command } from "commander";
import {
  renderInstallResult,
  runInstallUseCase,
} from "./install/install-use-case.js";
import {
  renderVerifyResult,
  runVerifyUseCase,
} from "./install/verify-use-case.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("zeroclaw-setup")
    .description(
      "GonkaGate-backed ZeroClaw onboarding with install and read-only verify flows.",
    )
    .showHelpAfterError()
    .option(
      "-m, --model <id>",
      "GonkaGate model id from the live /v1/models catalog",
    )
    .action(async (options: { model?: string }) => {
      const result = await runInstallUseCase({ model: options.model });
      console.log(renderInstallResult(result));
    });

  program
    .command("verify")
    .description(
      "Read-only verification of the saved GonkaGate contract and active ZeroClaw runtime.",
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
