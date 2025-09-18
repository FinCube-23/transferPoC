const fs = require("fs")
const path = require("path")

module.exports = {
    trackDataSaver: async function (
        file_name: string,
        key_name: string,
        value: any
    ) {
        // Create path to grand-parent directory
        const grandParentDir = path.resolve(__dirname, "../..")
        const jsonLogDir = path.join(grandParentDir, "json-log")
        const filePath = path.join(jsonLogDir, `${file_name}.json`)

        // Create json-log directory if it doesn't exist
        if (!fs.existsSync(jsonLogDir)) {
            fs.mkdirSync(jsonLogDir, { recursive: true })
            console.log(`Created directory: ${jsonLogDir}`)
        }

        // json data
        const jsonData = `{ "${key_name}" : "${value}" }`

        try {
            fs.writeFileSync(filePath, jsonData, "utf8")
            console.log(`JSON file has been saved to: ${filePath}`)
        } catch (err) {
            console.log("An error occurred while writing JSON Object to File.")
            console.log(err)
        }
    },
}
