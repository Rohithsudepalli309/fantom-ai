
export interface PromptCategory {
    category: string;
    prompts: string[];
}

export const promptLibrary: PromptCategory[] = [
    {
        category: 'Creative Writing',
        prompts: [
            'Write a short story about a robot who discovers music.',
            'Describe a futuristic city from the perspective of a bird.',
            'Create a dialogue between the sun and the moon.',
            'Write a poem about the sound of rain on a tin roof.',
        ],
    },
    {
        category: 'Business & Marketing',
        prompts: [
            'Generate 5 taglines for a new brand of eco-friendly coffee.',
            'Write a marketing email to announce a 20% off summer sale.',
            'Brainstorm ideas for a social media campaign for a local bookstore.',
            'Draft a mission statement for a tech startup focused on AI education.',
        ],
    },
    {
        category: 'Coding & Tech',
        prompts: [
            'Explain the concept of recursion in simple terms with a code example in Python.',
            'Write a JavaScript function to reverse a string.',
            'What are the pros and cons of using a NoSQL database vs. a SQL database?',
            'Create a simple HTML and CSS template for a personal portfolio website.',
        ],
    },
    {
        category: 'Everyday Life',
        prompts: [
            'Help me plan a healthy 3-day meal plan.',
            'Suggest some fun and affordable weekend activities for a family with young children.',
            'How can I write a professional but friendly email to my boss asking for a day off?',
            'Give me a step-by-step guide to repotting a houseplant.',
        ],
    },
];
