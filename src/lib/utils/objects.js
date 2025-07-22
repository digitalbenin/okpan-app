export const getObjectIdentifier = (object) => {
    console.log("getObjectIdentifier", object);
    return object.objectsOntologyFields?.find(
        (f) => f.primary
    )?.value || "Identifier not set";
}