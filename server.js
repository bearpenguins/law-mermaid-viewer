const express = require("express");
const multer = require("multer");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

/**
 * Extracts valid Mermaid code from Claude output.
 * Ensures the response always starts with `graph TD` or `graph LR`.
 */
function extractMermaid(text) {
    if (typeof text !== "string") {
        return 'graph TD\nA["Invalid Claude response"]';
    }

    const match = text.match(/(graph\s+(TD|LR)[\s\S]*)/);
    if (!match) {
        return 'graph TD\nA["No valid Mermaid diagram returned"]';
    }

    const styles = `
classDef case fill:#fef3c7,stroke:#92400e,color:#000;
classDef person fill:#e0f2fe,stroke:#0369a1,color:#000;
classDef organisation fill:#dcfce7,stroke:#166534,color:#000;
classDef legal_issue fill:#fee2e2,stroke:#991b1b,color:#000;
classDef event fill:#ede9fe,stroke:#5b21b6,color:#000;
classDef document fill:#f1f5f9,stroke:#334155,color:#000;
classDef location fill:#fff7ed,stroke:#9a3412,color:#000;
`;

    return match[1].trim() + "\n\n" + styles;
}


const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.static("."));

app.post("/generate", upload.array("files"), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
        return res.status(400).send(
            'graph TD\nA["No files uploaded"]'
        );
    }

        let combinedText = "";

        for (const file of req.files) {
            combinedText += `\n\n===== FILE: ${file.originalname} =====\n\n`;
            combinedText += fs.readFileSync(file.path, "utf8");
        }

        const prompt = fs.readFileSync("prompt.txt", "utf8");

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": process.env.CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 2000,
                messages: [
                    {
                        role: "user",
                        content: `${prompt}\n\nDOCUMENTS:\n${combinedText}`
                    }
                ]
            })
        });

        const data = await response.json();

        console.log(
            "FULL CLAUDE RESPONSE:\n",
            JSON.stringify(data, null, 2)
        );

        if (!response.ok || !data || !Array.isArray(data.content)) {
            console.error("Claude API error or unexpected response format");
            return res.status(500).send(
                'graph TD\nA["Claude API error – check server logs"]'
            );
        }

        const claudeText = data.content[0]?.text;

        res.send(extractMermaid(claudeText));

    } catch (err) {
        console.error("SERVER ERROR:", err);
        res.status(500).send(
            'graph TD\nA["Server error – see logs"]'
        );
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at https://your-railway-subdomain.up.railway.app`);
});

