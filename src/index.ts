import JSZip, { forEach } from "JSZip";
import FileSaver from "file-saver";

import { paddIndex, removeAllChilds, replaceAll } from "./util"

const d3_graphviz = require("d3-graphviz");

// Elements
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const dirInput = document.getElementById("dir-input") as HTMLInputElement;
// const reloadButton = document.getElementById("reload") as HTMLButtonElement;
const columnsInput = document.getElementById("table-column") as HTMLInputElement;
const outputFormats = document.getElementsByName("output-format"); // as HTMLInputElement(s)
const saveAllButton = document.getElementById("save-all") as HTMLButtonElement;
const graphTable = document.getElementById("graph-table") as HTMLTableElement;
// const pngDataUrlElement = document.getElementById("png-dataurl") as HTMLImageElement;
const pngCanvas = document.getElementById("png-canvas") as HTMLCanvasElement;

// Globals
var globalFlag = false;
var columns: number = 3;
var currentGraphs: any[] = [];
var currentAvailableFiles: File[] = null;
var loadedDots: string[] = [];

function dumpGlobals() {
    console.log(`columns:${columns},\ncurrentGraphs:${currentGraphs},\ncurrentAvailableFiles:${currentAvailableFiles}`);
    console.log(currentGraphs[0]);
}

function createTable(table: HTMLTableElement, totalItems: number, columns: number): HTMLDivElement[] {
    removeAllChilds(table);
    let containerList: HTMLDivElement[] = [];
    let rows = Math.ceil(totalItems / columns);
    for (let i = 0; i < rows; i++) {
        let tableRow = document.createElement("tr");
        for (let j = 0; j < columns; j++) {
            let idNumber = i * columns + j;
            if (idNumber < totalItems) {
                let tableData = document.createElement("td");
                let container = document.createElement("div")
                container.className = "graph-container";
                container.id = `graph_${idNumber}`;

                containerList.push(container);

                tableData.appendChild(container);
                tableRow.appendChild(tableData);
            }
        }
        table.appendChild(tableRow);
    }
    return containerList;
}

function displayDot(table: HTMLTableElement, dotList: string[], columns: number) {
    let containerList: HTMLDivElement[] = createTable(table, dotList.length, columns);
    let graphList = [];
    for (let index = 0; index < containerList.length; index++) {
        if (index < dotList.length) {
            let graph = d3_graphviz.graphviz(`#${containerList[index].id}`, { useWorker: false }).renderDot(dotList[index]);
            graphList.push(graph);
            // } else {
            //     let content = document.createTextNode(" ");
            //     containerList[index].appendChild(content);
        }
    }
    return graphList;
}

function exportSVGString(container_id: string, callback?: CallableFunction): string {
    const svgElement = document.querySelector("#" + container_id + " > svg") as SVGScriptElement;
    svgElement.setAttribute("version", "1.1");
    svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (callback != null) callback(svgElement);
    return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?> \n" + svgElement.outerHTML;
    // return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?> \n" + new XMLSerializer().serializeToString(svgElement);
}

function exportPNGBlob(container_id: string, canvas: HTMLCanvasElement, callback?: BlobCallback): void {
    let svgString = exportSVGString(container_id);
    // let svgString = exportSVGString(container_id, (svg:SVGScriptElement) => {
    //     console.log(svg.getAttribute("width"));
    //     console.log(svg.getAttribute("height"));

    //     canvas.setAttribute("width", svg.getAttribute("width"));
    //     canvas.setAttribute("height", svg.getAttribute("height"));
    // });
    let svgBase64Data = "data:image/svg+xml;base64," + btoa(svgString);

    var image = new Image();
    image.src = svgBase64Data;

    image.onload = function () {
        let context = canvas.getContext("2d");
        canvas.width = image.width;
        canvas.height = image.height;
        context.drawImage(image, 0, 0);

        let byteString = atob(canvas.toDataURL().replace(/^data:image\/(png|jpg);base64,/, ""));
        let ab = new ArrayBuffer(byteString.length);
        let ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        let dataView = new DataView(ab);
        let binaryData = new Blob([dataView], { type: "image/png" });

        // var a = document.createElement("a");
        // a.download = "sample.png";
        // a.href = canvas.toDataURL("image/png");
        // a.click();
        callback(binaryData);
    };
}

async function handleFileInputEvent(event: Event) {
    let element = event.target as HTMLInputElement;
    let files = element.files;
    let fileList = [];
    for (let index = 0; index < files.length; index++) {
        fileList.push(files.item(index));
    }
    fileList.sort((a: File, b: File) => {
        if (a.name > b.name)
            return 1;
        else if (a.name < b.name)
            return -1;
        else
            return 0;
    });
    // console.log(files);
    currentAvailableFiles = [];
    loadedDots = [];
    for (let index = 0; index < fileList.length; index++) {
        let f = fileList[index];
        if (!f.name.endsWith(".dot"))
            continue;
        currentAvailableFiles.push(f);
        try {
            await f.text().then((str) => loadedDots.push(str));
        } catch (err) {
            console.error(err);
        }
    }
    console.debug("File loaded.");
    currentGraphs = displayDot(graphTable, loadedDots, columns);
    // dumpGlobals();
}

// Initialization
columnsInput.value = columns.toString();

// Events
fileInput.addEventListener("input", handleFileInputEvent);
dirInput.addEventListener("input", handleFileInputEvent);

// reloadButton.addEventListener("click", async (event) => {
//     loadedDots = [];

//     for (let index = 0; index < currentAvailableFiles.length; index++) {
//         try {
//             await currentAvailableFiles[index].text().then((str) => loadedDots.push(str));
//         } catch (err) {
//             console.error(err);
//         }
//         console.debug("File loaded.");
//         currentGraphs = displayDot(graphTable, loadedDots, columns);
//     }
// });

columnsInput.addEventListener("change", (event) => {
    let element = event.target as HTMLInputElement;
    let val = Number(element.value);
    if (val != columns) {
        columns = val;
        console.debug("Columns changed.")
        currentGraphs = displayDot(graphTable, loadedDots, columns);
    }
});

saveAllButton.addEventListener("click", () => {
    let renderers = currentGraphs.copyWithin(0, 0);
    // console.log(currentRenderers);

    let type = "svg";
    for (let index = 0; index < outputFormats.length; index++) {
        let radioElement = outputFormats[index] as HTMLInputElement;
        if (radioElement.checked)
            type = radioElement.value;
    }
    // pack zip
    if (renderers.length > 0) {
        let zip = new JSZip();

        let date = new Date()
        let zipName = replaceAll(date.toLocaleString(), "/", "-");
        zipName = replaceAll(zipName, ":", ".");
        zipName = replaceAll(zipName, " ", "_");

        console.log(`saving ${zipName}`);

        var saveZip = () => {
            zip.generateAsync({ type: "blob" })
                .then((content) => {
                    FileSaver.saveAs(content, `${zipName}_output.zip`);
                });
        }

        if (type == "png") {
            for (let index = 0; index < renderers.length; index++) {
                exportPNGBlob(`graph_${index}`, pngCanvas,
                    (b: Blob) => {
                        let strIndex = paddIndex(index, renderers.length, "0");
                        zip.file(`output_${strIndex}.png`, b);
                        if (index >= renderers.length - 1) saveZip(); // monkey patch
                    });
            }
        } else if (type == "svg") {
            for (let index = 0; index < renderers.length; index++) {
                // TODO: need settings
                let svgString = exportSVGString(`graph_${index}`);

                let strIndex = paddIndex(index, renderers.length, "0");
                zip.file(`output_${strIndex}.svg`, svgString);
            }
            saveZip();
        } else {
            return;
        }
    }
});


// var DEFAULTS = {
//     margin: 20,
//     width: 2048,
//     height: 2048,
//     nodes: {
//       reducer: null,
//       defaultColor: "#999"
//     },
//     edges: {
//       reducer: null,
//       defaultColor: "#ccc"
//     }
//   };