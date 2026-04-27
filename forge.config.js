import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import fs from 'fs-extra';
import path from 'path';

export default {
    packagerConfig: {
        name: 'DataConnectionTool',
        executableName: "DataConnectionTool",
        // Disable ASAR to prevent native .node extraction to temp, ensuring DLLs
        // like libvips are loaded from their adjacent directory on Windows
        asar: false,
        prune: true,
        ignore: [
            /^\/artic-dataset($|\/)/,
            /^\/docs($|\/)/,
            /^\/src\/db\/db_sample_data($|\/)/,
            /^\/src\/db\/seed_data($|\/)/,
            /^\/node_modules($|\/)/,
            /^\/src\/website\/node_modules($|\/)/
        ],
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

            const rootNodeModules = path.resolve('node_modules');
            const buildNodeModules = path.join(buildPath, 'node_modules');
            const copiedDestinations = new Set();
            const queuedPackages = new Set();

            async function readPackageJson(packageDir) {
                const pkgPath = path.join(packageDir, 'package.json');
                try {
                    const data = await fs.readFile(pkgPath, 'utf-8');
                    return JSON.parse(data);
                } catch {
                    return null;
                }
            }

            function getSourceNodeModulesBase(packageDir) {
                const normalized = path.normalize(packageDir);

                if (normalized === rootNodeModules || normalized.startsWith(`${rootNodeModules}${path.sep}`)) {
                    return rootNodeModules;
                }

                if (normalized === buildNodeModules || normalized.startsWith(`${buildNodeModules}${path.sep}`)) {
                    return buildNodeModules;
                }

                return null;
            }

            function getPackageLookupStartDirs(fromDir) {
                if (!fromDir) return [rootNodeModules, buildNodeModules];

                const starts = [];
                let currentDir = path.normalize(fromDir);

                while (currentDir && currentDir !== path.dirname(currentDir)) {
                    starts.push(currentDir);
                    currentDir = path.dirname(currentDir);
                }

                starts.push(rootNodeModules, buildNodeModules);
                return [...new Set(starts)];
            }

            function resolveInstalledPackageDir(pkgName, fromDir) {
                const packageSegments = pkgName.split('/');
                const searchRoots = getPackageLookupStartDirs(fromDir);

                for (const searchRoot of searchRoots) {
                    const nodeModulesDir = path.basename(searchRoot) === 'node_modules'
                        ? searchRoot
                        : path.join(searchRoot, 'node_modules');

                    const packageDir = path.join(nodeModulesDir, ...packageSegments);
                    if (fs.existsSync(path.join(packageDir, 'package.json'))) {
                        return packageDir;
                    }
                }

                return null;
            }

            async function copyResolvedPackage(packageDir) {
                const sourceBase = getSourceNodeModulesBase(packageDir);
                if (!sourceBase) return false;

                const relativePackageDir = path.relative(sourceBase, packageDir);
                const dest = path.join(viteNodeModules, relativePackageDir);
                if (copiedDestinations.has(dest)) return true;

                await fs.copy(packageDir, dest, {
                    filter: (src) => !src.includes(`${path.sep}node_modules${path.sep}.bin${path.sep}`)
                });
                copiedDestinations.add(dest);
                return true;
            }

            async function ensureCopyDeep(pkgName, fromDir = rootNodeModules) {
                const packageDir = resolveInstalledPackageDir(pkgName, fromDir);
                if (!packageDir) {
                    console.warn(`packageAfterCopy: Skipping missing package '${pkgName}'`);
                    return;
                }

                const queue = [packageDir];

                while (queue.length) {
                    const currentPackageDir = queue.shift();
                    if (queuedPackages.has(currentPackageDir)) continue;
                    queuedPackages.add(currentPackageDir);

                    await copyResolvedPackage(currentPackageDir);

                    const pkgJson = await readPackageJson(currentPackageDir);
                    const depFields = ['dependencies', 'optionalDependencies', 'peerDependencies'];
                    for (const field of depFields) {
                        const deps = pkgJson?.[field] || {};
                        for (const depName of Object.keys(deps)) {
                            const depDir = resolveInstalledPackageDir(depName, currentPackageDir);
                            if (!depDir || queuedPackages.has(depDir)) continue;
                            queue.push(depDir);
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
                'onnxruntime',
                // P2P/runtime packages that are externalized from the main-process bundle
                '@winstonfassett/y-webrtc-trystero',
                'trystero',
                'node-datachannel',
                'ws',
                'yjs',
                'y-protocols',
                'webtorrent',
                '@thaunknown/simple-peer',
                'bittorrent-dht',
                'bittorrent-tracker',
                'utp-native',
                'fs-chunk-store',
                'torrent-discovery',
                'ut_metadata',
                'ut_pex'
            ];

            for (const pkg of externals) {
                try {
                    console.log(`packageAfterCopy: Copying runtime package '${pkg}'`);
                    await ensureCopyDeep(pkg);
                } catch (err) {
                    console.error(`packageAfterCopy: Failed while copying runtime package '${pkg}'`, err);
                    throw err;
                }
            }

            // Small helper to DRY file/dir copy patterns
            async function copyPathIfExists(srcPath, destPath, label) {
                try {
                    if (await fs.pathExists(srcPath)) {
                        const stats = await fs.stat(srcPath);
                        if (stats.isDirectory()) {
                            await fs.ensureDir(destPath);
                        } else {
                            await fs.ensureDir(path.dirname(destPath));
                        }
                        await fs.copy(srcPath, destPath, { overwrite: true });
                        console.log(`packageAfterCopy: Copied ${label} to '${destPath}'`);
                        return true;
                    } else {
                        console.warn(`packageAfterCopy: ${label} not found at ${srcPath}`);
                        return false;
                    }
                } catch (err) {
                    console.warn(`packageAfterCopy: Failed to copy ${label}:`, err);
                    return false;
                }
            }

            // Ensure renderer output is placed under app root so electron-serve (directory: 'build') finds it
            const targetBuildDir = path.join(buildPath, 'build');
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

            // Copy the website SPA build so the website:// protocol can serve it
            await copyPathIfExists(
                path.join(process.cwd(), 'src', 'website', 'build'),
                path.join(buildPath, 'src', 'website', 'build'),
                'website SPA build'
            );

            // Copy prebuilt static-export website artifact used by runtime website export
            await copyPathIfExists(
                path.join(process.cwd(), 'src', 'website', 'build-export'),
                path.join(buildPath, 'src', 'website', 'build-export'),
                'website static export build'
            );

            // Copy the development SQLite database into the packaged app
            await copyPathIfExists(
                path.join(process.cwd(), 'src', 'db', 'local.db'),
                path.join(buildPath, 'src', 'db', 'local.db'),
                'database file'
            );

            // Copy ontology default fields JSON into the packaged app
            await copyPathIfExists(
                path.join(process.cwd(), 'src', 'db', 'default_ontology_fields.json'),
                path.join(buildPath, 'src', 'db', 'default_ontology_fields.json'),
                'ontology defaults JSON'
            );

            // Copy static assets used by main process (icons, styles, models) into packaged app
            await copyPathIfExists(
                path.join(process.cwd(), 'src', 'assets'),
                path.join(buildPath, 'src', 'assets'),
                'assets directory'
            );

            // Models are bundled under 'resources/app/src/assets/models'; embedding service resolves packaged path.
        }
    }
};