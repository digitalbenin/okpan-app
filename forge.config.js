import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import fs from 'fs-extra';
import path from 'path';

export default {
    packagerConfig: {
        name: 'Data Connection Tool',
        executableName: "DataConnectionTool",
        // Disable ASAR to prevent native .node extraction to temp, ensuring DLLs
        // like libvips are loaded from their adjacent directory on Windows
        asar: false,
        prune: false,
        asarUnpack: [
            '.vite/node_modules/@libsql/**',
            '.vite/node_modules/sharp/**/*',
            '.vite/node_modules/@img/**/*',
            '.vite/node_modules/@xenova/transformers/**',
            '.vite/node_modules/onnxruntime-node/**',
            '.vite/node_modules/onnxruntime/**',
            '.vite/node_modules/libsql/**'
        ]
    },
    rebuildConfig: {},
    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {},
        },
        {
            name: '@electron-forge/maker-zip',
            platforms: ['darwin'],
        },
        {
            name: '@electron-forge/maker-deb',
            config: {},
        },
        {
            name: '@electron-forge/maker-rpm',
            config: {},
        },
    ],
    plugins: [
        {
            name: '@electron-forge/plugin-vite',
            config: {
                build: [
                    {
                        entry: 'src/backend/main.js',
                        config: 'vite.main.config.js',
                    },
                    {
                        entry: 'src/preload/preload.js',
                        config: 'vite.preload.config.js',
                    }
                ],
                renderer: [
                    {
                        name: 'main_window',
                        config: 'vite.config.js'
                    }
                ]
            },
        },
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            // Allow loading unpacked native binaries (e.g. sharp/@img) outside asar
            [FuseV1Options.OnlyLoadAppFromAsar]: false,
        }),
    ],
    // Ensure external runtime deps resolve from .vite/node_modules in packaged app
    hooks: {
        packageAfterCopy: async (_configuration, buildPath) => {
            const viteNodeModules = path.join(buildPath, '.vite', 'node_modules');
            await fs.ensureDir(viteNodeModules);

            const copied = new Set();

            async function readPackageJson(baseNodeModules, pkgName) {
                const pkgPath = path.join(baseNodeModules, pkgName, 'package.json');
                try {
                    const data = await fs.readFile(pkgPath, 'utf-8');
                    return JSON.parse(data);
                } catch {
                    return null;
                }
            }

            async function copyPackage(baseNodeModules, pkgName) {
                if (copied.has(pkgName)) return true;
                const src = path.join(baseNodeModules, pkgName);
                const dest = path.join(viteNodeModules, pkgName);
                if (!(await fs.pathExists(src))) return false;
                await fs.copy(src, dest);
                copied.add(pkgName);
                return true;
            }

            async function ensureCopyDeep(pkgName) {
                const rootNodeModules = path.resolve('node_modules');
                const buildNodeModules = path.join(buildPath, 'node_modules');

                // Determine source base
                let base = rootNodeModules;
                if (!(await fs.pathExists(path.join(base, pkgName)))) {
                    base = buildNodeModules;
                }
                if (!(await fs.pathExists(path.join(base, pkgName)))) {
                    // Package not found; skip without online install to keep offline builds
                    console.warn(`packageAfterCopy: Skipping missing package '${pkgName}'`);
                    return;
                }

                const queue = [pkgName];
                const seen = new Set();

                while (queue.length) {
                    const current = queue.shift();
                    if (seen.has(current)) continue;
                    seen.add(current);

                    // Copy the package folder
                    await copyPackage(base, current);

                    // Read its dependencies and enqueue them
                    const pkgJson = await readPackageJson(base, current);
                    const depFields = ['dependencies', 'optionalDependencies', 'peerDependencies'];
                    for (const field of depFields) {
                        const deps = pkgJson?.[field] || {};
                        for (const depName of Object.keys(deps)) {
                            if (seen.has(depName)) continue;
                            // Prefer root node_modules as base if available
                            const rootHas = await fs.pathExists(path.join(path.resolve('node_modules'), depName));
                            const buildHas = await fs.pathExists(path.join(buildNodeModules, depName));
                            if (!rootHas && !buildHas) continue; // Skip missing
                            // If dependency exists in root, copy from root; else from build
                            const depBase = rootHas ? path.resolve('node_modules') : buildNodeModules;
                            // Copy immediately to ensure availability
                            await copyPackage(depBase, depName);
                            queue.push(depName);
                        }
                    }
                }
            }

            // Top-level externals we expect to need at runtime
            const externals = [
                '@libsql',
                'libsql',
                '@libsql/client',
                'graphql',
                'graphql-tools',
                'sharp',
                // Explicitly copy Sharp's Windows vendor packages for packaged runtime
                '@img/sharp-win32-x64',
                '@img/sharp-libvips-win32-x64',
                '@xenova/transformers',
                'onnxruntime-node',
                'onnxruntime'
            ];

            for (const pkg of externals) {
                await ensureCopyDeep(pkg);
            }

            // Ensure renderer output is placed where main.js expects it
            // main.js loads '../../build/index.html' relative to its dir,
            // which resolves to 'resources/build/index.html' in the installed app.
            const resourcesDir = path.join(buildPath, '..');
            const targetBuildDir = path.join(resourcesDir, 'build');
            const candidateRendererDirs = [
                // SvelteKit adapter-static default output
                path.join(process.cwd(), 'build'),
                // Vite plugin renderer default output
                path.join(buildPath, '.vite', 'renderer', 'main_window')
            ];
            try {
                let copiedFrom = null;
                for (const dir of candidateRendererDirs) {
                    if (await fs.pathExists(dir)) {
                        await fs.ensureDir(targetBuildDir);
                        await fs.copy(dir, targetBuildDir, { overwrite: true });
                        copiedFrom = dir;
                        break;
                    }
                }
                if (copiedFrom) {
                    console.log(`packageAfterCopy: Copied renderer from '${copiedFrom}' to '${targetBuildDir}'`);

                    // Post-process HTML to convert absolute '/_app/...' URLs to relative './_app/...'
                    const htmlFiles = (await fs.readdir(targetBuildDir)).filter(f => f.toLowerCase().endsWith('.html'));
                    for (const html of htmlFiles) {
                        const fp = path.join(targetBuildDir, html);
                        try {
                            let content = await fs.readFile(fp, 'utf-8');
                            content = content
                                .replace(/href="\/_app\//g, 'href="./_app/')
                                .replace(/src="\/_app\//g, 'src="./_app/')
                                .replace(/import\("\/_app\//g, 'import("./_app/')
                                .replace(/<base\s+href="\/">/g, '<base href="./">');
                            await fs.writeFile(fp, content);
                            console.log(`packageAfterCopy: Rewrote asset URLs in '${html}' to relative paths`);
                        } catch (err) {
                            console.warn(`packageAfterCopy: Failed to rewrite '${html}':`, err);
                        }
                    }
                } else {
                    console.warn('packageAfterCopy: Renderer output not found in expected locations');
                }
            } catch (err) {
                console.warn('packageAfterCopy: Failed to place renderer build:', err);
            }
        }
    }
};