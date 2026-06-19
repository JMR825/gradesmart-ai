import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from app.grading import grade_answer

def evaluate(sample_data_path: str):
    with open(sample_data_path) as f:
        samples = json.load(f)
    results = []
    for s in samples:
        score = grade_answer(s["student_answer"], s["reference_answer"])
        diff = abs(score - s["human_score"])
        results.append({
            "id": s["id"],
            "student_answer": s["student_answer"],
            "reference_answer": s["reference_answer"],
            "ai_score": round(score, 2),
            "human_score": s["human_score"],
            "difference": round(diff, 2),
        })
        print(f"{s['id']}: AI={score:.2f} Human={s['human_score']} Diff={diff:.2f}")
    avg_diff = sum(r["difference"] for r in results) / len(results)
    print(f"\nAverage difference: {avg_diff:.2f}")
    return results

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "sample_data.json")
    evaluate(path)
