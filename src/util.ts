export {paddIndex, replaceAll, removeAllChilds, sleep};

function paddIndex(index: number, maxValue: number, padString: string): string {
    let paddCount = 0;
    while (maxValue > 10) {
        maxValue /= 10;
        paddCount++;
    }
    while (index > 10) {
        index /= 10;
        paddCount--;
    }
    return padString.repeat(paddCount).concat(index.toString())
}

function replaceAll(target: string, search: string, replace: string): string {
    return target.split(search).join(replace);
}

function removeAllChilds(element: HTMLElement) {
    for (let index = element.childNodes.length - 1; index > -1; index--) {
        element.childNodes.item(index).remove();
    }
}

function sleep(duration: number) {
    return new Promise(resolve => {
        setTimeout(resolve, duration);
    })
}