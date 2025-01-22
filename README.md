# TreeGPT

A Next.js application that visualizes chat conversations with GPT in a tree-like graph structure.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- OpenAI API key

## Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/treegpt.git
cd treegpt
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory:

```bash
OPENAI_API_KEY=your_api_key_here
```

Replace `your_api_key_here` with your actual OpenAI API key.

## Running the Application

1. Start the development server:

```bash
npm run dev
# or
yarn dev
```

2. Open your browser and navigate to:

```
http://localhost:3000
```

(or the URL shown in your terminal)

## Features

- Interactive chat interface with GPT
- Visual representation of conversation flow
- Resizable split view between chat and graph
- Real-time conversation tree updates

## Tech Stack

- Next.js 14
- React
- React Flow
- Tailwind CSS
- OpenAI API
