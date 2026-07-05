const body = document.body;
const themeToggle = document.getElementById("themeToggle");
const studyTip = document.getElementById("studyTip");
const newTipButton = document.getElementById("newTip");
const searchInput = document.getElementById("topicSearch");
const topics = Array.from(document.querySelectorAll(".topic-card"));

const studyTips = [
  "Draw a quick mind map after reading each topic to remember key terms fast.",
  "Explain the concept to a friend or to yourself out loud — it helps you learn deeply.",
  "Connect motion with everyday examples like bicycle rides, swings, and car journeys.",
  "Use the right units: distance in metres, time in seconds, speed in m/s.",
  "Make a small table of mixtures and their separation methods for quick revision.",
];

const STORAGE_KEY = "savedQuizzes";
let quizData = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let savedQuizzes = [];
let currentQuiz = null;
let selectedAnswers = [];

function slugify(value) {
  return (
    String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "quiz"
  );
}

function normalizeQuizForStorage(quiz) {
  return {
    id: quiz.id || `${Date.now()}`,
    title: quiz.title || "Untitled Quiz",
    subject: quiz.subject || "General",
    topic: quiz.topic || "General",
    level: quiz.level || "Easy",
    questions: Array.isArray(quiz.questions) ? quiz.questions : [],
    createdAt: quiz.createdAt || new Date().toLocaleString(),
  };
}

function downloadQuizFile(quiz) {
  const blob = new Blob([JSON.stringify(quiz, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${slugify(quiz.subject)}-${slugify(quiz.topic)}-${slugify(quiz.title)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function loadQuizzesFromFiles(fileList) {
  const collected = [];
  const files = Array.from(fileList || []);

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".json")) continue;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      collected.push(normalizeQuizForStorage(parsed));
    } catch (error) {
      // Skip invalid files quietly.
    }
  }

  return collected;
}

async function loadQuizzesFromManifest() {
  try {
    const response = await fetch("quizzes/manifest.json", { cache: "no-store" });
    if (!response.ok) return [];

    const manifest = await response.json();
    const entries = Array.isArray(manifest?.quizzes) ? manifest.quizzes : [];
    const collected = [];

    for (const entry of entries) {
      const fileName = entry?.file || entry?.path || entry?.name;
      if (!fileName) continue;
      try {
        const fileResponse = await fetch(`quizzes/${encodeURIComponent(fileName)}`, { cache: "no-store" });
        if (!fileResponse.ok) continue;
        const parsed = await fileResponse.json();
        collected.push(normalizeQuizForStorage({ ...parsed, title: parsed.title || entry.title || fileName }));
      } catch (error) {
        // Skip invalid entries quietly.
      }
    }

    return collected;
  } catch (error) {
    return [];
  }
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function showTip() {
  if (!studyTip) return;
  studyTip.textContent = pickRandom(studyTips);
}

function filterTopics() {
  if (!searchInput) return;
  const query = searchInput.value.trim().toLowerCase();
  topics.forEach((card) => {
    const title = card.dataset.title.toLowerCase();
    const description = card.dataset.description.toLowerCase();
    const matches = title.includes(query) || description.includes(query);
    card.style.display = matches ? "grid" : "none";
  });
}

function toggleTheme() {
  const next = body.dataset.theme === "dark" ? "light" : "dark";
  body.dataset.theme = next;
  localStorage.setItem("studyTheme", next);
  if (themeToggle) {
    themeToggle.textContent = next === "dark" ? "☀️" : "🌙";
  }
}

function loadSavedQuizzes() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    savedQuizzes = stored ? JSON.parse(stored) : [];
  } catch (error) {
    savedQuizzes = [];
  }
}

function saveSavedQuizzes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedQuizzes));
}

function renderCreatePage() {
  const questionContainer = document.getElementById("questionContainer");
  const addQuestionBtn = document.getElementById("addQuestionBtn");
  const saveQuizBtn = document.getElementById("saveQuizBtn");
  const saveStatus = document.getElementById("saveStatus");
  const importTextInput = document.getElementById("quizJsonInput");
  const importFileInput = document.getElementById("quizJsonFile");
  const importBtn = document.getElementById("importJsonBtn");
  const clearBtn = document.getElementById("clearImportBtn");
  const importStatus = document.getElementById("importStatus");

  if (!questionContainer || !addQuestionBtn || !saveQuizBtn) return;

  function findCorrectAnswerIndex(options, answer) {
    const normalizedOptions = options.map((option) => String(option ?? "").trim());
    if (typeof answer === "number" && Number.isInteger(answer)) {
      return Math.max(0, Math.min(answer, 3));
    }
    if (typeof answer === "string" && answer.trim()) {
      const normalizedAnswer = answer.trim().toLowerCase();
      const foundIndex = normalizedOptions.findIndex((option) => option.toLowerCase() === normalizedAnswer);
      if (foundIndex >= 0) {
        return foundIndex;
      }
    }
    return 0;
  }

  function addQuestionBlock(questionData = {}) {
    const block = document.createElement("div");
    block.className = "question-block";
    const options = Array.isArray(questionData.options) ? questionData.options.slice(0, 4) : [];
    const normalizedOptions = [...options];
    while (normalizedOptions.length < 4) {
      normalizedOptions.push("");
    }
    const correctIndex = findCorrectAnswerIndex(
      normalizedOptions,
      questionData.answer ?? questionData.correctAnswer ?? questionData.correct ?? questionData.correctIndex ?? 0,
    );
    block.innerHTML = `
      <div class="form-group">
        <label>Question</label>
        <input type="text" class="question-text" placeholder="Type a question">
      </div>
      <div class="option-grid">
        <div class="form-group">
          <label>Option A</label>
          <input type="text" class="option-input" data-index="0" placeholder="Option A">
        </div>
        <div class="form-group">
          <label>Option B</label>
          <input type="text" class="option-input" data-index="1" placeholder="Option B">
        </div>
        <div class="form-group">
          <label>Option C</label>
          <input type="text" class="option-input" data-index="2" placeholder="Option C">
        </div>
        <div class="form-group">
          <label>Option D</label>
          <input type="text" class="option-input" data-index="3" placeholder="Option D">
        </div>
      </div>
      <div class="form-group">
        <label>Correct answer</label>
        <select class="correct-answer">
          <option value="0">Option A</option>
          <option value="1">Option B</option>
          <option value="2">Option C</option>
          <option value="3">Option D</option>
        </select>
      </div>
      <button class="mini-btn remove-question" type="button">Remove</button>
    `;

    const questionTextInput = block.querySelector(".question-text");
    const optionInputs = Array.from(block.querySelectorAll(".option-input"));
    const correctAnswerSelect = block.querySelector(".correct-answer");

    if (questionTextInput) {
      questionTextInput.value = questionData.question || questionData.questionText || questionData.prompt || "";
    }
    optionInputs.forEach((input, index) => {
      input.value = normalizedOptions[index] || "";
    });
    if (correctAnswerSelect) {
      correctAnswerSelect.value = String(correctIndex);
    }

    questionContainer.appendChild(block);
    block.querySelector(".remove-question").addEventListener("click", () => block.remove());
  }

  function populateFormFromData(importedData) {
    const rawQuiz = importedData && typeof importedData === "object" ? importedData : null;
    const normalizedQuiz =
      rawQuiz && Array.isArray(rawQuiz.questions)
        ? rawQuiz
        : rawQuiz && rawQuiz.quiz && Array.isArray(rawQuiz.quiz.questions)
          ? rawQuiz.quiz
          : Array.isArray(importedData)
            ? { questions: importedData }
            : null;

    if (!normalizedQuiz) {
      throw new Error("JSON must contain a quiz object or an array of questions.");
    }

    const titleInput = document.getElementById("quizTitle");
    const subjectInput = document.getElementById("quizSubject");
    const topicInput = document.getElementById("quizTopic");
    const levelInput = document.getElementById("quizLevel");

    if (titleInput) titleInput.value = normalizedQuiz.title || normalizedQuiz.name || normalizedQuiz.quizTitle || "";
    if (subjectInput) subjectInput.value = normalizedQuiz.subject || normalizedQuiz.subjectName || "";
    if (topicInput) topicInput.value = normalizedQuiz.topic || normalizedQuiz.chapter || normalizedQuiz.unit || "";
    if (levelInput) levelInput.value = normalizedQuiz.level || "Easy";

    questionContainer.innerHTML = "";
    const importedQuestions = Array.isArray(normalizedQuiz.questions) ? normalizedQuiz.questions : [];
    if (importedQuestions.length) {
      importedQuestions.forEach((question) => addQuestionBlock(question));
    } else {
      addQuestionBlock();
    }

    if (importStatus) {
      importStatus.textContent = `Imported ${importedQuestions.length} question${importedQuestions.length === 1 ? "" : "s"}.`;
      importStatus.style.color = "#15803d";
    }
  }

  function handleImport(rawValue) {
    if (!rawValue || !rawValue.trim()) {
      if (importStatus) {
        importStatus.textContent = "Paste JSON or choose a file first.";
        importStatus.style.color = "#b91c1c";
      }
      return;
    }

    try {
      const parsed = JSON.parse(rawValue);
      populateFormFromData(parsed);
    } catch (error) {
      if (importStatus) {
        importStatus.textContent = "The JSON could not be read. Check the format and try again.";
        importStatus.style.color = "#b91c1c";
      }
    }
  }

  addQuestionBtn.addEventListener("click", () => addQuestionBlock());
  importBtn?.addEventListener("click", () => {
    const rawValue = importTextInput?.value?.trim() || "";
    if (rawValue) {
      handleImport(rawValue);
      return;
    }

    const file = importFileInput?.files?.[0];
    if (!file) {
      if (importStatus) {
        importStatus.textContent = "Paste JSON or choose a file first.";
        importStatus.style.color = "#b91c1c";
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => handleImport(event.target?.result || "");
    reader.readAsText(file);
  });

  importFileInput?.addEventListener("change", (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result || "";
      if (importTextInput) importTextInput.value = content;
      handleImport(content);
    };
    reader.readAsText(file);
  });

  clearBtn?.addEventListener("click", () => {
    if (importTextInput) importTextInput.value = "";
    if (importFileInput) importFileInput.value = "";
    if (importStatus) {
      importStatus.textContent = "";
    }
    questionContainer.innerHTML = "";
    addQuestionBlock();
  });

  saveQuizBtn.addEventListener("click", async () => {
    const title = document.getElementById("quizTitle")?.value.trim();
    const subject = document.getElementById("quizSubject")?.value.trim();
    const topic = document.getElementById("quizTopic")?.value.trim();
    const level = document.getElementById("quizLevel")?.value;

    if (!title || !subject || !topic) {
      saveStatus.textContent = "Please fill the title, subject and topic.";
      saveStatus.style.color = "#b91c1c";
      return;
    }

    const blocks = Array.from(questionContainer.querySelectorAll(".question-block"));
    const questions = blocks
      .map((block) => {
        const questionText = block.querySelector(".question-text")?.value.trim();
        const optionInputs = Array.from(block.querySelectorAll(".option-input"));
        const optionValues = optionInputs.map((input) => input.value.trim());
        const options = optionValues.filter(Boolean);
        const correctAnswer = Number(block.querySelector(".correct-answer")?.value ?? 0);
        const answer = optionValues[correctAnswer]?.trim() || "";
        return questionText && options.length >= 2 && answer ? { question: questionText, options, answer } : null;
      })
      .filter(Boolean);

    if (!questions.length) {
      saveStatus.textContent = "Add at least one complete question.";
      saveStatus.style.color = "#b91c1c";
      return;
    }

    const quizToSave = normalizeQuizForStorage({
      id: `${Date.now()}`,
      title,
      subject,
      topic,
      level,
      questions,
      createdAt: new Date().toLocaleString(),
    });

    try {
      downloadQuizFile(quizToSave);
      savedQuizzes.unshift(quizToSave);
      saveSavedQuizzes();
      saveStatus.textContent = "Quiz downloaded as a JSON file. Place it in your quizzes folder and load it from the quizzes page.";
      saveStatus.style.color = "#15803d";
      document.getElementById("quizTitle").value = "";
      document.getElementById("quizSubject").value = "";
      document.getElementById("quizTopic").value = "";
      questionContainer.innerHTML = "";
      addQuestionBlock();
    } catch (error) {
      saveStatus.textContent = error.message || "The quiz could not be downloaded.";
      saveStatus.style.color = "#b91c1c";
    }
  });

  questionContainer.innerHTML = "";
  addQuestionBlock();
}

function renderQuizList() {
  const quizList = document.getElementById("quizList");
  const quizPlayerSection = document.getElementById("quizPlayerSection");
  const playerTitle = document.getElementById("playerTitle");
  const playerContent = document.getElementById("playerContent");

  if (!quizList) return;
  quizList.innerHTML = "";

  if (!savedQuizzes.length) {
    quizList.innerHTML = "<p>No quizzes are available yet. Ask your teacher to create one.</p>";
    return;
  }

  const cards = savedQuizzes
    .map(
      (quiz) => `
      <article class="quiz-card">
        <h3>${quiz.title}</h3>
        <p>${quiz.subject} • ${quiz.topic}</p>
        <div class="quiz-meta">
          <span>Level: ${quiz.level || "Easy"}</span>
          <span>Questions: ${quiz.questions.length}</span>
        </div>
        <button class="btn" type="button" data-quiz-id="${quiz.id}">Start Quiz</button>
      </article>
    `,
    )
    .join("");

  quizList.innerHTML = cards;
  quizList.querySelectorAll("button[data-quiz-id]").forEach((button) => {
    button.addEventListener("click", () => startStudentQuiz(button.dataset.quizId));
  });

  if (quizPlayerSection) quizPlayerSection.hidden = true;
  if (playerContent) playerContent.innerHTML = "";
}

function startStudentQuiz(quizId) {
  const quizPlayerSection = document.getElementById("quizPlayerSection");
  const playerTitle = document.getElementById("playerTitle");
  const playerContent = document.getElementById("playerContent");
  if (!quizPlayerSection || !playerTitle || !playerContent) return;

  currentQuiz = savedQuizzes.find((quiz) => quiz.id === quizId);
  if (!currentQuiz) return;

  currentQuestionIndex = 0;
  selectedAnswers = [];
  playerTitle.textContent = currentQuiz.title;
  quizPlayerSection.hidden = false;
  renderStudentQuestion();
}

function renderStudentQuestion() {
  const playerContent = document.getElementById("playerContent");
  const quizPlayerSection = document.getElementById("quizPlayerSection");
  if (!currentQuiz || !playerContent) return;

  const question = currentQuiz.questions[currentQuestionIndex];
  if (!question) return;

  const optionsHtml = question.options
    .map(
      (option, index) => `
      <button class="quiz-option" type="button" data-option="${option}">${option}</button>
    `,
    )
    .join("");

  playerContent.innerHTML = `
    <p><strong>Question ${currentQuestionIndex + 1} of ${currentQuiz.questions.length}</strong></p>
    <h3>${question.question}</h3>
    <div class="quiz-options">${optionsHtml}</div>
    <p class="quiz-feedback" id="studentFeedback"></p>
    <div class="quiz-controls">
      <button class="mini-btn" type="button" id="prevStudentQuestion">Previous</button>
      <button class="mini-btn" type="button" id="nextStudentQuestion">Next</button>
    </div>
  `;

  const optionButtons = playerContent.querySelectorAll(".quiz-option");
  optionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedAnswers[currentQuestionIndex] = button.dataset.option;
      const feedback = document.getElementById("studentFeedback");
      if (!feedback) return;
      if (button.dataset.option === question.answer) {
        feedback.textContent = "Correct!";
        feedback.className = "quiz-feedback correct";
      } else {
        feedback.textContent = `Correct answer: ${question.answer}`;
        feedback.className = "quiz-feedback incorrect";
      }
    });
  });

  const prevButton = document.getElementById("prevStudentQuestion");
  const nextButton = document.getElementById("nextStudentQuestion");
  if (prevButton) {
    prevButton.disabled = currentQuestionIndex === 0;
    prevButton.addEventListener("click", () => {
      if (currentQuestionIndex > 0) {
        currentQuestionIndex -= 1;
        renderStudentQuestion();
      }
    });
  }
  if (nextButton) {
    nextButton.disabled = currentQuestionIndex === currentQuiz.questions.length - 1;
    nextButton.addEventListener("click", () => {
      if (currentQuestionIndex < currentQuiz.questions.length - 1) {
        currentQuestionIndex += 1;
        renderStudentQuestion();
      } else {
        const score = currentQuiz.questions.reduce((count, question, index) => {
          return count + (selectedAnswers[index] === question.answer ? 1 : 0);
        }, 0);
        playerContent.innerHTML = `
          <h3>Quiz completed</h3>
          <p>You scored ${score} out of ${currentQuiz.questions.length}.</p>
          <button class="btn" type="button" id="restartQuiz">Try again</button>
        `;
        document.getElementById("restartQuiz")?.addEventListener("click", () => startStudentQuiz(currentQuiz.id));
      }
    });
  }

  if (quizPlayerSection) quizPlayerSection.hidden = false;
}

if (searchInput) {
  searchInput.addEventListener("input", filterTopics);
}
if (newTipButton) {
  newTipButton.addEventListener("click", showTip);
}
if (themeToggle) {
  themeToggle.addEventListener("click", toggleTheme);
}

document.addEventListener("DOMContentLoaded", () => {
  const storedTheme = localStorage.getItem("studyTheme");
  if (storedTheme) {
    body.dataset.theme = storedTheme;
    if (themeToggle) {
      themeToggle.textContent = storedTheme === "dark" ? "☀️" : "🌙";
    }
  }
  showTip();
  loadSavedQuizzes();

  if (document.getElementById("questionContainer")) {
    renderCreatePage();
  }
  if (document.getElementById("quizList")) {
    const folderButton = document.getElementById("loadFolderBtn");
    const folderStatus = document.getElementById("folderStatus");

    if (folderButton) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.multiple = true;
      input.style.display = "none";

      folderButton.addEventListener("click", async () => {
        try {
          const loadedQuizzes = await loadQuizzesFromManifest();
          if (loadedQuizzes.length) {
            savedQuizzes = loadedQuizzes;
            saveSavedQuizzes();
            renderQuizList();
            if (folderStatus) {
              folderStatus.textContent = `Loaded ${savedQuizzes.length} quiz${savedQuizzes.length === 1 ? "" : "zes"} from the manifest.`;
              folderStatus.style.color = "#15803d";
            }
            return;
          }
          input.click();
        } catch (error) {
          input.click();
        }
      });

      input.addEventListener("change", async () => {
        try {
          const loadedQuizzes = await loadQuizzesFromFiles(input.files);
          savedQuizzes = loadedQuizzes;
          saveSavedQuizzes();
          renderQuizList();
          if (folderStatus) {
            folderStatus.textContent = `Loaded ${savedQuizzes.length} quiz${savedQuizzes.length === 1 ? "" : "zes"} from the selected JSON files.`;
            folderStatus.style.color = "#15803d";
          }
        } catch (error) {
          if (folderStatus) {
            folderStatus.textContent = error.message || "Could not load quizzes from those files.";
            folderStatus.style.color = "#b91c1c";
          }
        }
      });
    }

    renderQuizList();
  }
});
