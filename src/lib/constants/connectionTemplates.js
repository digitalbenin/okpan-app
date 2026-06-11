
export const CONNECTION_TEMPLATES = [
    {
        id: 'custom',
        label: 'Custom',
        icon: 'bi-magic',
        color: 'cyan',
        description: 'Create a connection type from scratch',
        defaultConfig: {
            description: true,
            url: true,
            thumbnail: true,
            images: true,
            videos: true,
            audios: true
        }
    },
    {
        id: 'indigenous_designation',
        label: 'Indigenous designation',
        icon: 'bi-tags-fill',
        color: 'yellow',
        description: 'Record indigenous names/terms',
        defaultConfig: {
            description: true,
            url: true,
            thumbnail: true,
            images: true,
            videos: true,
            audios: true
        }
    },
    {
        id: 'iconography',
        label: 'Iconography',
        icon: 'bi-brush-fill',
        color: 'orange',
        description: 'Describe symbols and visual elements',
        defaultConfig: {
            description: true,
            url: true,
            thumbnail: true,
            images: true,
            videos: true,
            audios: true
        }
    },
    {
        id: 'place',
        label: 'Place',
        icon: 'bi-geo-alt-fill',
        color: 'indigo',
        description: 'Geographic locations and sites',
        defaultConfig: {
            description: true,
            url: true,
            thumbnail: true,
            images: true,
            videos: true,
            audios: true
        }
    },
    {
        id: 'oral_history',
        label: 'Oral history',
        icon: 'bi-mic-fill',
        color: 'blue',
        description: 'Recordings and transcripts',
        defaultConfig: {
            description: true,
            url: true,
            thumbnail: true,
            images: true,
            videos: true,
            audios: true
        }
    },
    {
        id: 'people',
        label: 'People',
        icon: 'bi-person-fill',
        color: 'green',
        description: 'Individuals and groups',
        defaultConfig: {
            description: true,
            url: true,
            thumbnail: true,
            images: true,
            videos: true,
            audios: true
        }
    }
];

export const DEFAULT_FIELDS_CONFIG = {
    description: true,
    url: true,
    thumbnail: true,
    images: true,
    videos: true,
    audios: true
};

export function getTemplateById(id) {
    return CONNECTION_TEMPLATES.find((t) => t.id === id) || null;
}

export function getTemplateColorClasses(templateId) {
    const template = getTemplateById(templateId);
    if (!template || !template.color) return { border: 'border-gray-500', text: 'text-gray-700' };
    return { border: `border-${template.color}-500`, text: `text-${template.color}-700` };
}
