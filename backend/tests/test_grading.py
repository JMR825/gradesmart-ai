import pytest
from app.grading import grade_answer

def test_exact_match():
    assert grade_answer("O(log n)", "O(log n)") >= 99.0

def test_semantic_similar():
    assert grade_answer("class inherits from another", "A class acquires properties of another class") >= 40.0

def test_unrelated():
    assert grade_answer("apples are fruits", "quantum mechanics") < 30.0

def test_blank():
    assert grade_answer("", "something") == 0.0
    assert grade_answer("something", "") == 0.0

def test_partial():
    assert grade_answer("TCP reliable", "TCP is reliable, UDP is fast") >= 20.0
