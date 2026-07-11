import re
from itertools import cycle
from typing import Iterable, List


DAILY_SENTENCES = [
    "Could you help me with this?",
    "I would like to improve my English.",
    "Can you say that one more time?",
    "I am trying to speak more clearly.",
    "Let me explain what happened today.",
    "I need a little more time.",
    "That sounds like a good idea.",
    "I usually practice in the evening.",
    "Could we discuss this after lunch?",
    "I am getting better every day.",
    "Please let me know your opinion.",
    "I want to speak with more confidence.",
]

INTERVIEW_SENTENCES = [
    "I worked on a challenging project recently.",
    "My strength is solving problems under pressure.",
    "I enjoy working with a team.",
    "I am excited to learn and contribute.",
    "I handled the issue by staying calm.",
    "This experience improved my communication skills.",
    "I take feedback seriously and improve quickly.",
    "I can explain technical ideas clearly.",
    "I managed my time and finished the task.",
    "I am comfortable asking thoughtful questions.",
    "I want to grow in a practical environment.",
    "I learned how to debug complex problems.",
]

PRONUNCIATION_SENTENCES = [
    "The circumstances were unexpected.",
    "She sells seashells by the seashore.",
    "This project requires regular practice.",
    "Clear speech creates confidence.",
    "Three thoughtful students solved the problem.",
    "The result was really remarkable.",
    "Please pronounce every syllable clearly.",
    "Strong rhythm makes speech sound natural.",
    "World class workers rarely waste words.",
    "The weather changed throughout the afternoon.",
    "Practice slowly before speaking quickly.",
    "Accurate pronunciation improves conversation.",
]

VOCABULARY_SENTENCES = [
    "Today we will practice the word confident.",
    "Confident means feeling sure about yourself.",
    "Use the word improve in a short sentence.",
    "Improve means to become better over time.",
    "The word clarify means to make something clear.",
    "Please clarify your answer with one example.",
    "Consistent practice creates visible progress.",
    "Consistent means happening regularly.",
    "The word contribute means to help with something.",
    "I want to contribute to the project.",
    "The word explain means to make someone understand.",
    "Can you explain your idea clearly?",
]

GENERAL_SENTENCES = [
    "I want to speak English more naturally.",
    "Please help me practice one sentence.",
    "I can improve with daily practice.",
    "Let us try that phrase again.",
    "Speaking clearly takes patience.",
    "I am ready for the next sentence.",
    "Good pronunciation makes communication easier.",
    "I want to learn useful everyday words.",
    "This sentence is good for practice.",
    "Please listen carefully and repeat.",
    "I will say the sentence slowly.",
    "Now I can say it with confidence.",
]


def _agent_text(agent_name: str = "", agent_instructions: str = "") -> str:
    return f"{agent_name} {agent_instructions}".lower()


def get_sentence_bank(agent_name: str = "", agent_instructions: str = "") -> List[str]:
    text = _agent_text(agent_name, agent_instructions)
    if "interview" in text:
        return INTERVIEW_SENTENCES
    if "pronunciation" in text or "drill" in text:
        return PRONUNCIATION_SENTENCES
    if "vocabulary" in text or "word" in text:
        return VOCABULARY_SENTENCES
    if "daily" in text or "conversation" in text:
        return DAILY_SENTENCES
    return GENERAL_SENTENCES


def get_initial_sentence(agent_name: str = "", agent_instructions: str = "") -> str:
    return get_sentence_bank(agent_name, agent_instructions)[0]


def get_next_sentence(
    agent_name: str = "",
    agent_instructions: str = "",
    previous_sentences: Iterable[str] = (),
) -> str:
    bank = get_sentence_bank(agent_name, agent_instructions)
    used = {s.strip().lower() for s in previous_sentences if s}
    for sentence in bank:
        if sentence.lower() not in used:
            return sentence
    first = next(cycle(bank))
    return first


def split_practice_words(sentence: str) -> List[str]:
    words = re.findall(r"[A-Za-z0-9']+", sentence or "")
    return words or [sentence.strip()] if sentence.strip() else []
