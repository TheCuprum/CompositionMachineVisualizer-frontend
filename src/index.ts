import Sigma from "sigma";
import Graph from "graphology";
import JSZip from "JSZip";
import FileSaver from "file-saver";

import { paddIndex, removeAllChilds, replaceAll } from "./util"
import { blob } from "stream/consumers";
// import { parse } from "graphology-gexf/browser";
import { table, time, timeStamp } from "console";

const { Graphviz, graphviz } = require("d3-graphviz/src/graphviz.js");
const d3_graphviz = require("d3-graphviz");
const resolveDefaults = require("graphology-utils/defaults");
const renderSVG = require("graphology-svg/renderer.js") // return string
var DEFAULTS = require("graphology-svg/defaults.js").DEFAULTS;

// Elements
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const columnsInput = document.getElementById("table-column") as HTMLInputElement;
const outputFormats = document.getElementsByName("output-format"); // as HTMLInputElement(s)
const saveAllButton = document.getElementById("save-all") as HTMLButtonElement;
const graphTable = document.getElementById("graph-table") as HTMLTableElement;
const pngDataUrlElement = document.getElementById("png-dataurl") as HTMLImageElement;
const pngCanvas = document.getElementById("png-canvas") as HTMLCanvasElement;

// Globals
const DATA_DIR = "./data"
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
            let tableData = document.createElement("td");
            let container = document.createElement("div")
            container.className = "graph-container";
            container.id = `graph_${idNumber}`;

            containerList.push(container);

            tableData.appendChild(container);
            tableRow.appendChild(tableData);
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
        } else {
            // let content = document.createTextNode(" ");
            // containerList[index].appendChild(content);
        }
    }
    return graphList;
}

function exportSVGString(container_id: string): string {
    const svgElement = document.querySelector("#" + container_id + " > svg");
    svgElement.setAttribute("version", "1.1");
    svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?> \n" + svgElement.outerHTML;
    // return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?> \n" + new XMLSerializer().serializeToString(svgElement);
}

async function exportPNGBlob(container_id: string, canvas: HTMLCanvasElement): Blob {
    let svgString = exportSVGString(container_id);
    let svgBase64Data = "data:image/svg+xml;base64," + btoa(svgString);

    let context = canvas.getContext("2d");
    var image = new Image();
    image.src = svgBase64Data;

    var blobContainer: Blob[] = [];
    image.onload = async function () {
        context.drawImage(image, 0, 0);

        //save and serve it as an actual filename
        var byteString = atob(pngCanvas.toDataURL().replace(/^data:image\/(png|jpg);base64,/, "")); //wtf is atob?? https://developer.mozilla.org/en-US/docs/Web/API/Window.atob
        var ab = new ArrayBuffer(byteString.length);
        var dataView = new DataView(ab);
        var blob = new Blob([dataView], { type: "image/png" });

        // var a = document.createElement("a");
        // a.download = "sample.png";
        // a.href = canvas.toDataURL("image/png");
        // a.click();
    };
    console.log("waiting...");
    while (blobContainer == []);

    return blobContainer[0];
    // await p;
    // while(!barrier.exported);
    // TODO: need layers configuration
    // p_list.push(p);
}

// Initialization
columnsInput.value = columns.toString();

// Events
columnsInput.addEventListener("change", (event) => {
    let element = event.target as HTMLInputElement;
    let val = Number(element.value);
    if (val != columns) {
        columns = val;
        console.log("Columns changed.")
        // currentGraphs.forEach((renderer) => renderer.kill());
        currentGraphs = displayDot(graphTable, loadedDots, columns);
    }
})
fileInput.addEventListener("change", async (event) => {
    let element = event.target as HTMLInputElement;
    let files = element.files;
    // console.log(files);
    currentAvailableFiles = [];
    loadedDots = [];
    for (let index = 0; index < files.length; index++) {
        let f = files.item(index);
        if (!f.name.endsWith(".dot"))
            continue;
        currentAvailableFiles.push(f);
        try {
            await f.text().then((str) => loadedDots.push(str));
        } catch (err) {
            console.error(err);
        }
    }
    console.log("File loaded.");
    // currentGraphs.forEach((renderer) => renderer.kill());
    currentGraphs = displayDot(graphTable, loadedDots, columns);
    dumpGlobals();
})

saveAllButton.addEventListener("click", async () => {
    let renderers = currentGraphs.copyWithin(0, 0);
    // console.log(currentRenderers);
    if (renderers.length > 0) {
        let date = new Date()
        let zipName = replaceAll(date.toLocaleString(), "/", "-");
        zipName = replaceAll(zipName, ":", ".");
        zipName = replaceAll(zipName, " ", "_");

        console.log(`saving ${zipName}`);


        let type = "png";
        for (let index = 0; index < outputFormats.length; index++) {
            let radioElement = outputFormats[index] as HTMLInputElement;
            if (radioElement.checked)
                type = radioElement.value;
        }
        // pack zip
        let zip = new JSZip();
        if (type == "png") {
            let p_list: Promise<void>[] = [];
            for (let index = 0; index < renderers.length; index++) {
                let blob = await exportPNGBlob(`graph-container_${index}`,pngCanvas);
                let strIndex = paddIndex(index, renderers.length, "0");
                zip.file(`output_${strIndex}.png`, blob);        
            }
            // await Promise.all(p_list);
        } else if (type == "svg") {
            for (let index = 0; index < renderers.length; index++) {
                // TODO: need settings
                let svgString = exportSVGString(`graph_${index}`);

                let strIndex = paddIndex(index, renderers.length, "0");
                zip.file(`output_${strIndex}.svg`, svgString);
            }
        } else {
            return;
        }
        zip.generateAsync({ type: "blob" })
            .then((content) => {
                FileSaver.saveAs(content, `${zipName}_output.zip`);
            });
    }
});




function renderPNG(arg0: any, arg1: (blob: any) => void, LAYERS: any) {
    throw new Error("Function not implemented.");
}

function LAYERS(arg0: any, arg1: (blob: any) => void, LAYERS: any) {
    throw new Error("Function not implemented.");
}
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