import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySectionChoiceRules,
  GeneratedAnswerKey,
  matchQuestionNumbers,
} from './sectionChoice.js';

test('matchQuestionNumbers correctly handles roman numerals, sub-questions, and letters', () => {
  assert.equal(matchQuestionNumbers('1(a)', 'Q.1 (a)'), true);
  assert.equal(matchQuestionNumbers('1(a)(iv)', '1.A.iv'), true);
  assert.equal(matchQuestionNumbers('2', 'Q2'), true);
  assert.equal(matchQuestionNumbers('2', '3'), false);
});

test('applySectionChoiceRules enforces B.C.A. Linux 60-mark structure with top N scoring', () => {
  const answerKey: GeneratedAnswerKey = {
    paper_max_marks: 60,
    sections: [
      {
        section_name: 'Part I',
        attempt_limit: 10,
        marks_per_question: 1,
        section_max_marks: 10,
      },
      {
        section_name: 'Part II',
        attempt_limit: 4,
        marks_per_question: 6,
        section_max_marks: 24,
      },
      {
        section_name: 'Part III',
        attempt_limit: 2,
        marks_per_question: 10,
        section_max_marks: 20,
      },
    ],
    questions: [
      // Part I - 10 questions (1 mark each)
      { q_no: '1.a', section_name: 'Part I', max_marks: 1, model_answer: 'ans', key_points: ['ans'] },
      { q_no: '1.b', section_name: 'Part I', max_marks: 1, model_answer: 'ans', key_points: ['ans'] },
      { q_no: '1.c', section_name: 'Part I', max_marks: 1, model_answer: 'ans', key_points: ['ans'] },
      { q_no: '1.d', section_name: 'Part I', max_marks: 1, model_answer: 'ans', key_points: ['ans'] },
      { q_no: '1.e', section_name: 'Part I', max_marks: 1, model_answer: 'ans', key_points: ['ans'] },
      { q_no: '1.f', section_name: 'Part I', max_marks: 1, model_answer: 'ans', key_points: ['ans'] },
      { q_no: '1.g', section_name: 'Part I', max_marks: 1, model_answer: 'ans', key_points: ['ans'] },
      { q_no: '1.h', section_name: 'Part I', max_marks: 1, model_answer: 'ans', key_points: ['ans'] },
      { q_no: '1.i', section_name: 'Part I', max_marks: 1, model_answer: 'ans', key_points: ['ans'] },
      { q_no: '1.j', section_name: 'Part I', max_marks: 1, model_answer: 'ans', key_points: ['ans'] },
      // Part II - 6 questions (Attempt any 4, 6 marks each)
      { q_no: '2', section_name: 'Part II', max_marks: 6, model_answer: 'ans', key_points: ['ans'] },
      { q_no: '3', section_name: 'Part II', max_marks: 6, model_answer: 'ans', key_points: ['ans'] },
      { q_no: '4', section_name: 'Part II', max_marks: 6, model_answer: 'ans', key_points: ['ans'] },
      { q_no: '5', section_name: 'Part II', max_marks: 6, model_answer: 'ans', key_points: ['ans'] },
      { q_no: '6', section_name: 'Part II', max_marks: 6, model_answer: 'ans', key_points: ['ans'] },
      { q_no: '7', section_name: 'Part II', max_marks: 6, model_answer: 'ans', key_points: ['ans'] },
      // Part III - 3 questions (Attempt any 2, 10 marks each)
      { q_no: '8', section_name: 'Part III', max_marks: 10, model_answer: 'ans', key_points: ['ans'] },
      { q_no: '9', section_name: 'Part III', max_marks: 10, model_answer: 'ans', key_points: ['ans'] },
      { q_no: '10', section_name: 'Part III', max_marks: 10, model_answer: 'ans', key_points: ['ans'] },
    ],
  };

  // Student attempts:
  // Part I: all 10 correct -> 10 marks
  // Part II: attempts 5 questions (Q2: 6, Q3: 5, Q4: 4, Q5: 3, Q6: 2). Top 4 should be counted (6 + 5 + 4 + 3 = 18). Q6 (2 marks) should not be counted.
  // Part III: attempts Q8 (8 marks) and Q9 (9 marks) -> 17 marks. Q10 not attempted.
  const studentQuestions = [
    { q_no: '1.a', suggested_marks: 1, transcribed_text: 'ans' },
    { q_no: '1.b', suggested_marks: 1, transcribed_text: 'ans' },
    { q_no: '1.c', suggested_marks: 1, transcribed_text: 'ans' },
    { q_no: '1.d', suggested_marks: 1, transcribed_text: 'ans' },
    { q_no: '1.e', suggested_marks: 1, transcribed_text: 'ans' },
    { q_no: '1.f', suggested_marks: 1, transcribed_text: 'ans' },
    { q_no: '1.g', suggested_marks: 1, transcribed_text: 'ans' },
    { q_no: '1.h', suggested_marks: 1, transcribed_text: 'ans' },
    { q_no: '1.i', suggested_marks: 1, transcribed_text: 'ans' },
    { q_no: '1.j', suggested_marks: 1, transcribed_text: 'ans' },
    { q_no: '2', suggested_marks: 6, transcribed_text: 'ans' },
    { q_no: '3', suggested_marks: 5, transcribed_text: 'ans' },
    { q_no: '4', suggested_marks: 4, transcribed_text: 'ans' },
    { q_no: '5', suggested_marks: 3, transcribed_text: 'ans' },
    { q_no: '6', suggested_marks: 2, transcribed_text: 'ans' },
    { q_no: '8', suggested_marks: 8, transcribed_text: 'ans' },
    { q_no: '9', suggested_marks: 9, transcribed_text: 'ans' },
  ];

  const result = applySectionChoiceRules(answerKey, studentQuestions);

  // Check total paper marks
  assert.equal(result.paperMaxMarks, 60);
  // Total awarded: Part I (10) + Part II (6+5+4+3=18) + Part III (8+9=17) = 45
  assert.equal(result.totalScore, 45);

  // Check section summaries
  assert.equal(result.sections.length, 3);

  const part2 = result.sections.find(s => s.section_name === 'Part II')!;
  assert.equal(part2.attempt_limit, 4);
  assert.equal(part2.section_score, 18);
  assert.equal(part2.section_max_marks, 24);

  const part3 = result.sections.find(s => s.section_name === 'Part III')!;
  assert.equal(part3.attempt_limit, 2);
  assert.equal(part3.section_score, 17);
  assert.equal(part3.section_max_marks, 20);

  // Check question statuses
  const q6 = result.reviewItems.find(q => q.q_no === '6')!;
  assert.equal(q6.isCounted, false);
  assert.match(q6.statusLabel || '', /Optional \/ Extra — Not Counted/);

  const q10 = result.reviewItems.find(q => q.q_no === '10')!;
  assert.equal(q10.isCounted, false);
  assert.match(q10.statusLabel || '', /Optional — Not Attempted/);
});
