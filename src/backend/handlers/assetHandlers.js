import * as fs from 'fs';
import sharp from 'sharp';
import { db } from '../../db/init.js';
import { assets, genericAssets } from '../../db/schema.js';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const sm = 300
const md = 1400
const maxSize = 5000000 // 5Mb
const assetPath = "./src/assets/project_assets"
const imagesFormats = ["png", "jpg", "jpeg", "webp", "gif", "avif"]
const videoFormats = ["mp4", "webm", "ogg"]
const audioFormats = ["mp3", "wav", "ogg", "m4a"]



const getCroppedUUID = () => {
    return uuidv4().slice(0, 8);
}

const getProgress = (progress, total) => {
    return Math.round((progress / total) * 100)
}


const checkAssetType = (path) => {

    //check by file extension
    const ext = path.split(".").pop()
    if (imagesFormats.includes(ext)) {
        return "image"
    }
    if (videoFormats.includes(ext)) {
        return "video"
    }
    if (audioFormats.includes(ext)) {
        return "audio"
    }
    return "unknown"
}


const handleImportAssets = async (event, data) => {
    let progress = 0
    let loading = true
    let errors = []
    let createdAssets = []; // Array to store created assets

    console.log("asset handler data", data)

    if (!data.projectId) {
        throw new Error("Project ID is required");
    }
    // data.isGenericAsset will determine the target table.
    // If data.isGenericAsset is true, institutionId should be null or undefined.
    // If data.isGenericAsset is false or undefined, institutionId is expected for 'assets' table.
    if (data.isGenericAsset && data.institutionId) {
        console.warn("Warning: isGenericAsset is true, but institutionId is provided. institutionId will be ignored for generic assets.");
    }


    //check if folder with projectid is present, otherwise create it
    const projectFolder = path.join(assetPath, data.projectId);
    if (!fs.existsSync(projectFolder)) {
        fs.mkdirSync(projectFolder, { recursive: true });
    }

    // make a set of AVIF for each file in the directory
    if (data.isDirectory) {
        const files = fs.readdirSync(data.path);
        const totalFiles = files.length;
        for (const file of files) {
            try {
                const assetType = checkAssetType(file)
                let formats = null;

                if (assetType === "image") {
                    formats = await makeAVIF(path.join(data.path, file), projectFolder);
                }

                const asset = {
                    project_id: data?.projectId,
                    // Conditionally set institution_id only if not a generic asset
                    institution_id: data.isGenericAsset ? undefined : data?.institutionId,
                    path: formats?.original || path.join(projectFolder, file),
                    filename: path.basename(file),
                    type: assetType,
                    formats: formats || null
                }
                const newAsset = await saveAssetToDb(asset, data.isGenericAsset)
                createdAssets.push(newAsset);

                progress++;
                console.log(`${progress}/${totalFiles} files processed`);
            } catch (error) {
                errors.push(error);
            }
        }
    }
    // if it's not a directory then it's an ARRAY of files
    else {
        const totalFiles = data.path.length;
        for (const file of data.path) {
            try {
                console.log("processing file", file)
                const assetType = checkAssetType(file)
                let formats = null;

                if (assetType === "image") {
                    console.log("making avif for image", file)
                    formats = await makeAVIF(file, projectFolder);
                    const asset = {
                        project_id: data?.projectId,
                        // Conditionally set institution_id only if not a generic asset
                        institution_id: data.isGenericAsset ? undefined : data?.institutionId,
                        path: formats.original,
                        filename: path.basename(file),
                        type: assetType,
                        formats
                    }
                    console.log("saving asset to db", asset)
                    const newAsset = await saveAssetToDb(asset, data.isGenericAsset)
                    createdAssets.push(newAsset);
                }
                progress++;
                console.log(`${progress}/${totalFiles} files processed`);
            } catch (error) {
                errors.push(error);
            }
        }
    }
    loading = false
    return {
        errors,
        createdAssets // Return the list of created assets
    }
}

const makeAVIF = async (imagePath, destPath) => {
    const image = sharp(imagePath)
    const metadata = await image.metadata()
    const format = metadata.format
    const fileName = path.basename(imagePath);
    const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const uuid = getCroppedUUID();
    const newFileName = `${fileNameWithoutExt}_${uuid}`;
    destPath = path.join(destPath, newFileName);
    const origSize = metadata.size;
    if (origSize > maxSize) {
        throw new Error("File is too large");
    }
    if (format === "avif") {
        await image.resize(sm).toFile(`${destPath}_sm.avif`);
        await image.resize(md).toFile(`${destPath}_md.avif`);
        fs.copyFileSync(imagePath, `${destPath}.avif`);
    }
    else {
        await image.avif({ quality: 70, effort: 2, smartSubsample: true }).resize(sm).toFile(`${destPath}_sm.avif`);
        await image.avif({ quality: 70, effort: 2, smartSubsample: true }).resize(md).toFile(`${destPath}_md.avif`);
        await image.avif({ quality: 70, effort: 2, smartSubsample: true }).toFile(`${destPath}.avif`);
    }

    // Return the paths for the asset object
    return {
        sm: `${destPath}_sm.avif`,
        md: `${destPath}_md.avif`,
        original: `${destPath}.avif`
    };
}

const saveAssetToDb = async (assetData, isGeneric) => {
    console.log("Saving asset to DB:", assetData, "Is generic:", isGeneric);
    const table = isGeneric ? genericAssets : assets;
    const [newAsset] = await db.insert(table).values({
        id: uuidv4(),
        ...assetData,
        // Ensure institution_id is explicitly set to null if it's undefined and not a generic asset
        // For generic assets, institution_id should not be part of assetData passed here if schema doesn't have it
        institution_id: isGeneric ? undefined : (assetData.institution_id || null),
    }).returning();
    return newAsset;
}

export { handleImportAssets, getProgress }
