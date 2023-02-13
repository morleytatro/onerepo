import { Logger } from './Logger';
import type { Step } from './Step';

export * from './Logger';
export * from './Step';

export const logger = new Logger({ verbosity: 0 });

type WrapperArgs = {
	name: string;
	step?: Step;
};

export async function stepWrapper<T>(
	{ name, step: inputStep }: WrapperArgs,
	fn: (step: Step) => Promise<T>
): Promise<T> {
	const step = inputStep ?? logger.createStep(name);

	const out = await fn(step);

	!inputStep && (await step.end());

	return out;
}
