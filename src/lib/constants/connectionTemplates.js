
export const CONNECTION_TEMPLATES = [
    {
        id: 'custom',
        label: 'Custom',
        icon: 'bi-magic',
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
