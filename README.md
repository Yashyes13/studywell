# Studywell

Studywell turns class notes or a topic into an interactive flashcard set or multiple choice quiz. The React frontend talks to a small Express API; the Gemini key stays on the server. Notes are sent to Google Gemini to generate the study set.

## Run locally

Requirements: Node.js 20 or newer and a Gemini API key.

1. Install the root and frontend dependencies:

   ```sh
   npm install
   npm install --prefix frontend
   ```

2. Copy `.env.example` to `.env` and add your key:

   ```text
   GEMINI_API_KEY=your_key_here
   ```

3. Start the API and Vite together:

   ```sh
   npm start
   ```

4. Open <http://localhost:5173>.

The API health check is at <http://localhost:5000/api/health>. Set `GEMINI_MODEL` to use another supported Gemini model. The default is `gemini-3.8-flash`. If you change `PORT`, update the Vite proxy target in `frontend/vite.config.js` to match.

## Using the app

Paste up to 12,000 characters of notes or enter a topic, choose Flashcards or Quick quiz, and create a study set. Flashcards flip to reveal answers and can be marked as known. Quizzes explain each answer and offer a retest of missed questions. Save session stores the current set in this browser; Saved session restores it later. Use Space and the arrow keys to work through flashcards.

## AI usage

The Gemini API generates structured JSON for either flashcards or a quiz. The server requests a JSON response schema, parses the response, and validates every field with Zod before returning it. The browser only receives validated data. The input is framed as study material so instructions pasted into notes are not treated as directions for the model. AI assistance was used to review the assignment, design the interface, draft implementation code, and identify edge cases. The implementation and API behavior should be reviewed and understood before extending or presenting it.

## Failure handling

- Empty input and oversized input are rejected with a clear message.
- The API checks generated JSON against mode-specific schemas and rejects malformed, empty, incomplete, or out-of-range output.
- Provider, quota, authentication, and network failures return user-facing errors with a retry path.
- A new generation aborts any previous browser request, and cancelled responses cannot replace the active result.
- Loading, empty, and error states are rendered explicitly. The UI adapts to narrow screens and honors reduced-motion preferences.

## Known limitations

- Requires an internet connection and a Gemini API key; model availability and free-tier quotas vary.
- The model can still make factual mistakes. Review generated answers against the original material.
- Sessions are stored in browser local storage, on this device and browser only; there is no account or cloud sync.
- No streaming, editing follow-up, or export yet.

## Time spent

Approximately 2 hours on the core implementation and review. This is an estimate, not a time-tracked figure.

## Submission checklist

- [x] React hooks and functional components
- [x] Free-form text input and real LLM call through a backend
- [x] Structured, validated model data rendered as interactive UI
- [x] Loading, empty, failure, and retry states
- [x] Responsive mobile layout
- [x] Setup, AI-use note, limitations, and time estimate
- [ ] Screen recording (record locally after adding your own API key)
- [ ] Publish a GitHub repository or grant access to the intended reviewer
