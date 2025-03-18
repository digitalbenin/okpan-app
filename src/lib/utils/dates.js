const epochToDate = (epoch, time = false) => {
    const d = new Date(+epoch);

    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();

    if (time) {
        const hours = d.getHours();
        const minutes = d.getMinutes();
        const seconds = d.getSeconds();

        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    }

    return `${day}/${month}/${year}`;
};

export { epochToDate };

