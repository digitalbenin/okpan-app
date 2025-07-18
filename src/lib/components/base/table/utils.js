// Helper function to check if render result is a component object
function isComponentObject(renderResult) {
    return (
        renderResult &&
        typeof renderResult === "object" &&
        renderResult.component &&
        typeof renderResult.component === "function"
    );
}

// Helper function to get render result
export function getRenderResult(header, value, item) {
    if (!header.render) return { type: "value", value };

    if (typeof header.render === "function") {
        const result = header.render(value, item);

        if (isComponentObject(result)) {
            return {
                type: "component",
                component: result.component,
                props: result.props || {},
            };
        }

        return { type: "function", value: result };
    }

    return { type: "value", value: header.render };
}