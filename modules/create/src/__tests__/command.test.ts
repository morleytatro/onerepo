import inquirer from 'inquirer';
import * as file from '@onerepo/file';
import * as subprocess from '@onerepo/subprocess';
import { getCommand } from '@onerepo/test-cli';
import { getPackageManager } from '@onerepo/package-manager';
import * as command from '../command';

const { run } = getCommand(command);

jest.mock('@onerepo/file');
jest.mock('@onerepo/subprocess');

describe('handler', () => {
	beforeEach(() => {
		jest.spyOn(process.stderr, 'write').mockImplementation(() => {
			return true;
		});
		jest.spyOn(file, 'write').mockResolvedValue();
		jest.spyOn(file, 'exists').mockResolvedValue(false);
		jest.spyOn(file, 'chmod').mockResolvedValue();
		jest.spyOn(subprocess, 'run').mockImplementation(async ({ cmd, args }) => {
			if (cmd === 'yarn') {
				if (args && args[0] === '--version') {
					return ['3.5.0', ''];
				}
			}

			if (cmd === 'pnpm') {
				if (args && args[0] === '--version') {
					return ['7.29.3', ''];
				}
			}

			if (cmd === 'npm') {
				if (args && args[0] === '--version') {
					return ['9.5.0', ''];
				}
			}

			return ['', ''];
		});
		jest
			.spyOn(global, 'fetch')
			.mockResolvedValueOnce(new Response(JSON.stringify(mockSearchResponse)))
			.mockResolvedValueOnce(new Response(JSON.stringify(mockPackageResponse)));
	});

	test('prompts and uses responses', async () => {
		jest
			.spyOn(inquirer, 'prompt')
			.mockResolvedValue({ dir: 'outdir', pkgmanager: 'yarn', name: 'tacos', workspaces: 'foo,bar', plugins: [] });
		await run();

		expect(inquirer.prompt).toHaveBeenCalledTimes(2);

		expect(subprocess.run).toHaveBeenCalledWith(expect.objectContaining({ cmd: 'yarn', args: ['init', '-2'] }));

		expect(file.write).toHaveBeenCalledWith(
			'outdir/package.json',
			JSON.stringify(
				{
					name: 'tacos',
					license: 'UNLICENSED',
					private: true,
					packageManager: 'yarn@3.5.0',
					dependencies: { onerepo: '^4.5.6' },
					workspaces: ['foo/*', 'bar/*'],
				},
				null,
				2
			)
		);

		expect(file.write).toHaveBeenCalledWith('outdir/bin/tacos.mjs', expect.stringContaining('#!/usr/bin/env node'));
		expect(file.write).toHaveBeenCalledWith('outdir/bin/tacos.mjs', expect.stringContaining("name: 'tacos'"));
		expect(file.chmod).toHaveBeenCalledWith('outdir/bin/tacos.mjs', 0o755);

		expect(subprocess.run).toHaveBeenCalledWith(
			expect.objectContaining({
				cmd: 'git',
				args: ['init'],
				opts: { cwd: 'outdir' },
			})
		);
	});

	test.each([
		['yarn', ['init', '-2']],
		['npm', ['init', '-y']],
		['pnpm', ['init']],
	] as const)('initializes %s', async (pkgmanager, args) => {
		const mgr = getPackageManager(pkgmanager);
		jest.spyOn(mgr, 'install').mockResolvedValue('');
		jest
			.spyOn(inquirer, 'prompt')
			.mockResolvedValue({ dir: 'outdir', pkgmanager, name: 'tacos', workspaces: 'foo,bar', plugins: [] });

		await run();

		expect(inquirer.prompt).toHaveBeenCalledTimes(2);
		expect(subprocess.run).toHaveBeenCalledWith(expect.objectContaining({ cmd: pkgmanager, args: ['--version'] }));
		expect(subprocess.run).toHaveBeenCalledWith(expect.objectContaining({ cmd: pkgmanager, args }));
		expect(mgr.install).toHaveBeenCalled();
	});
});

const mockSearchResponse = {
	objects: [
		{
			package: {
				name: '@onerepo/plugin-jest',
				version: '1.2.3',
			},
		},
	],
};

const mockPackageResponse = {
	'dist-tags': {
		latest: '4.5.6',
	},
};
