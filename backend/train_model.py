import logging, os
import numpy as np
from torch.utils.data import DataLoader
from sentence_transformers import SentenceTransformer, InputExample, losses, evaluation

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "app", "custom_model")
os.makedirs(OUTPUT_PATH, exist_ok=True)

TRAINING_PAIRS = [
    ("Stack follows LIFO order", "Stack uses Last-In-First-Out (LIFO) principle", 0.95),
    ("Stack has LIFO behavior", "LIFO is the correct property of a stack", 0.90),
    ("Stack is like a queue", "Stack uses LIFO while queue uses FIFO", 0.35),
    ("Queue follows FIFO order", "Queue uses First-In-First-Out (FIFO) principle", 0.95),
    ("Queue has FIFO behavior", "FIFO is the correct property of a queue", 0.90),
    ("A linked list has nodes with pointers", "Linked list consists of nodes connected by pointers", 0.90),
    ("Array elements stored contiguously", "Arrays store elements in contiguous memory locations", 0.92),
    ("Binary search requires sorted array", "Binary search works only on sorted arrays", 0.88),
    ("Binary search has O(log n) complexity", "Time complexity of binary search is O(log n)", 0.95),
    ("Binary search time is O(n)", "The time complexity of binary search is O(log n)", 0.30),
    ("Selection sort picks minimum", "Selection sort repeatedly selects the minimum element", 0.90),
    ("Quick sort uses divide and conquer", "Quick sort uses partitioning and recursion", 0.85),
    ("Merge sort O(n log n) worst case", "Merge sort runs in O(n log n) time in all cases", 0.92),
    ("Bubble sort swaps adjacent", "Bubble sort swaps adjacent elements if out of order", 0.88),
    ("Hash table uses key-value pairs", "A hash table stores key-value pairs using a hash function", 0.92),
    ("Hash table O(1) average lookup", "Average case search in hash table is O(1)", 0.90),
    ("Dijkstra finds shortest path", "Dijkstra's algorithm finds shortest path in weighted graph", 0.90),
    ("Dijkstra fails with negative edges", "Dijkstra does not work with negative weight edges", 0.92),
    ("DP stores subproblem results", "DP solves problems by storing and reusing subproblem solutions", 0.90),
    ("Greedy picks local optimum", "Greedy algorithms make locally optimal choices at each step", 0.88),
    ("DFS uses stack for depth-first", "DFS uses a stack to explore as far as possible along each branch", 0.90),
    ("BFS uses queue for breadth-first", "BFS uses a queue to explore all neighbors at the current depth", 0.90),
    ("Deadlock waits forever", "Deadlock is a state where processes are blocked waiting for each other", 0.88),
    ("Mutex allows one thread at a time", "A mutex provides mutual exclusion for thread synchronization", 0.90),
    ("Virtual memory uses page tables", "Virtual memory maps logical to physical via page tables", 0.88),
    ("LRU replaces least recently used", "LRU evicts the page not used for the longest time", 0.90),
    ("Round Robin time quantum", "Round Robin scheduling gives each process a fixed time slice", 0.90),
    ("Thrashing is excessive paging", "Thrashing occurs when system spends more time paging than executing", 0.92),
    ("Primary key uniquely identifies", "A primary key uniquely identifies each row in a table", 0.92),
    ("Foreign key references primary key", "A foreign key references the primary key of another table", 0.90),
    ("Normalization reduces redundancy", "Normalization eliminates redundant data and ensures dependency", 0.88),
    ("ACID atomicity consistency isolation durability", "ACID properties ensure reliable database transactions", 0.95),
    ("SQL is declarative", "SQL lets you specify what data without specifying how", 0.85),
    ("JOIN combines rows from two tables", "A JOIN combines rows from two tables based on a related column", 0.90),
    ("TCP connection-oriented reliable", "TCP provides reliable and connection-oriented data delivery", 0.92),
    ("UDP connectionless faster", "UDP is connectionless with lower latency but no reliability", 0.90),
    ("IP identifies device on network", "An IP address uniquely identifies a device on an IP network", 0.90),
    ("OSI model has 7 layers", "The OSI reference model has seven layers from physical to application", 0.95),
    ("HTTP uses port 80", "HTTP uses TCP port 80 by default", 0.92),
    ("DNS converts domain to IP", "DNS resolves domain names to IP addresses", 0.92),
    ("India independence 1947", "India gained independence from British rule on August 15, 1947", 0.90),
    ("Mughal empire 1526", "The Mughal Empire started in 1526 by Babur", 0.85),
    ("Ashoka Buddhism after Kalinga", "Ashoka adopted Buddhism following the Kalinga War", 0.90),
    ("Salt March led by Gandhi", "Gandhi led the Dandi Salt March in 1930", 0.92),
    ("Quit India Movement 1942", "Quit India Movement was launched by Gandhi in August 1942", 0.92),
    ("Paris is capital of France", "Paris is the capital city of France", 0.95),
    ("Amazon largest river by volume", "Amazon River carries the largest water volume of any river", 0.90),
    ("Himalayas are fold mountains", "Himalayas formed by tectonic plate collision", 0.85),
    ("Monsoon seasonal wind reversal", "Monsoon is seasonal reversal of wind bringing rainfall", 0.88),
    ("Constitution adopted 1950", "Constitution of India was adopted on January 26, 1950", 0.90),
    ("Fundamental Rights Part III", "Part III of Indian Constitution guarantees Fundamental Rights", 0.88),
    ("Parliament Lok Sabha Rajya Sabha", "Indian Parliament consists of Lok Sabha and Rajya Sabha", 0.92),
    ("President constitutional head", "President of India is the constitutional head of state", 0.90),
    ("Supreme Court highest court", "Supreme Court of India is the apex judicial body", 0.92),
    ("Photosynthesis converts CO2 to O2", "Photosynthesis uses sunlight to convert CO2 into oxygen", 0.90),
    ("Newton first law inertia", "Newton's first law: object remains at rest or in motion unless acted upon", 0.85),
    ("E=mc^2 energy mass", "E=mc^2 shows energy equals mass times speed of light squared", 0.88),
    ("Water boils at 100 Celsius", "Boiling point of water at standard pressure is 100C", 0.95),
    ("DNA double helix", "DNA molecule has double helix structure discovered by Watson and Crick", 0.92),
    ("Binary search on unsorted", "Binary search requires sorted array data to work correctly", 0.15),
    ("Queue uses LIFO", "Queue follows FIFO not LIFO which is for stacks", 0.15),
    ("Merge sort is O(n^2)", "Merge sort has O(n log n) not O(n^2)", 0.10),
    ("Stack uses FIFO", "Stack uses LIFO not FIFO", 0.15),
    ("Hash table always O(n)", "Hash table has O(1) average case for search", 0.10),
    ("Dijkstra handles negative edges", "Dijkstra does not work with negative weight edges", 0.10),
    ("TCP is connectionless", "TCP is connection-oriented not connectionless", 0.10),
    ("Independence in 1950", "India gained independence in 1947 not 1950", 0.15),
    ("Paris is in Germany", "Paris is the capital of France not Germany", 0.05),
    ("Java same as JavaScript", "Java and JavaScript are completely different languages", 0.10),
    ("Stack LIFO recursion", "Stack uses LIFO and is used in function call management", 0.80),
    ("Quick sort pivot partition", "Quick sort selects a pivot and partitions average O(n log n)", 0.85),
    ("Deadlock four conditions", "Deadlock requires mutual exclusion hold wait no preemption circular wait", 0.75),
    ("Normalization reduces duplication", "Normalization reduces data redundancy through table decomposition", 0.78),
    ("Constitution 22 parts", "Indian Constitution originally had 22 parts and 395 articles", 0.72),
    ("Linked list dynamic size", "Linked list can grow and shrink dynamically unlike arrays", 0.80),
    ("Array random access O(1)", "Arrays provide O(1) random access by index", 0.85),
    ("Recursion uses call stack", "Recursive functions use the call stack to manage function calls", 0.82),
]

def main():
    logger.info("Loading base model: %s", MODEL_NAME)
    model = SentenceTransformer(MODEL_NAME)

    logger.info("Preparing %d training pairs...", len(TRAINING_PAIRS))
    train_samples = [InputExample(texts=[stu, ref], label=sc) for stu, ref, sc in TRAINING_PAIRS[:-15]]
    val_samples = [InputExample(texts=[stu, ref], label=sc) for stu, ref, sc in TRAINING_PAIRS[-15:]]

    train_dataloader = DataLoader(train_samples, shuffle=True, batch_size=16)
    train_loss = losses.CosineSimilarityLoss(model)

    evaluator = evaluation.EmbeddingSimilarityEvaluator(
        [s.texts[0] for s in val_samples],
        [s.texts[1] for s in val_samples],
        [s.label for s in val_samples],
        show_progress_bar=False,
    )

    logger.info("Starting fine-tuning...")
    model.fit(
        train_objectives=[(train_dataloader, train_loss)],
        evaluator=evaluator,
        epochs=5,
        evaluation_steps=20,
        warmup_steps=10,
        output_path=OUTPUT_PATH,
        save_best_model=True,
        show_progress_bar=True,
    )

    model.save(OUTPUT_PATH)
    logger.info("Model saved to %s", OUTPUT_PATH)

    test_pairs = [
        ("Stack uses LIFO", "Stack follows Last-In-First-Out"),
        ("Paris capital of France", "Capital of France is Paris"),
        ("Binary search O(log n)", "Binary search has O(log n) complexity"),
        ("India independence 1947", "India got freedom in 1947"),
        ("TCP is reliable", "TCP provides reliable delivery"),
        ("Quick sort pivot", "Quick sort uses partitioning"),
        ("Queue follows FIFO", "Queue is First-In-First-Out"),
    ]

    logger.info("Post-training sanity check:")
    model = SentenceTransformer(OUTPUT_PATH)
    for a, b in test_pairs:
        ea = model.encode(a, show_progress_bar=False)
        eb = model.encode(b, show_progress_bar=False)
        score = round(float(np.dot(ea, eb) / (np.linalg.norm(ea) * np.linalg.norm(eb))) * 100, 2)
        logger.info("  %6.2f | %s", score, a)

    logger.info("Done! Model ready at: %s", OUTPUT_PATH)

if __name__ == "__main__":
    main()
