import streamlit as st
import sqlite3
import pandas as pd
from datetime import datetime, timedelta, time
import json
import random

# --- SETTINGS & CONFIG ---
st.set_page_config(page_title="Academic Optimizer Pro", layout="wide", initial_sidebar_state="collapsed")

# --- DATABASE INITIALIZATION ---
def init_db():
    conn = sqlite3.connect('study_planner.db')
    cursor = conn.cursor()
    
    # Study Tasks Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT,
            deadline TEXT,
            weightage INTEGER,
            confidence INTEGER,
            est_time REAL,
            category TEXT,
            status TEXT
        )
    ''')
    
    # Flashcards Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS flashcards (
            id TEXT PRIMARY KEY,
            front TEXT,
            back TEXT,
            last_reviewed TEXT,
            interval INTEGER
        )
    ''')
    
    # Protected Blocks Table (Fixed daily college hours etc)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS blocks (
            id TEXT PRIMARY KEY,
            name TEXT,
            start_hour INTEGER,
            start_minute INTEGER,
            end_hour INTEGER,
            end_minute INTEGER
        )
    ''')
    
    # Optimized Schedule Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS schedule (
            id TEXT PRIMARY KEY,
            task_id TEXT,
            scheduled_date TEXT,
            start_time TEXT,
            end_time TEXT,
            title TEXT
        )
    ''')
    
    conn.commit()
    return conn

conn = init_db()

# --- SCHEDULING ENGINE ---
def calculate_priority(task, now_date):
    """
    Calculates priority based on deadline urgency, weightage, and confidence gap.
    """
    deadline = datetime.strptime(task['deadline'], '%Y-%m-%d').date()
    days_left = max((deadline - now_date).days, 1)
    
    # Deadlines are the absolute multiplier
    w_deadline = 100.0
    w_weightage = 2.0
    w_confidence = 1.5
    
    score = (w_deadline / days_left) + (task['weightage'] * w_weightage) + ((11 - task['confidence']) * w_confidence)
    return round(score, 2)

def optimize_schedule():
    """
    Multi-Day Bin Packing Algorithm.
    Constraints: 5h daily cap, No study 10AM-5PM (Mon-Fri).
    """
    cursor = conn.cursor()
    
    # 1. Fetch incomplete tasks
    cursor.execute("SELECT * FROM tasks WHERE status != 'completed'")
    rows = cursor.fetchall()
    tasks = [
        {'id': r[0], 'title': r[1], 'deadline': r[2], 'weightage': r[3], 
         'confidence': r[4], 'est_time': r[5], 'category': r[6]} for r in rows
    ]
    
    # 2. Sort by priority
    today = datetime.now().date()
    sorted_tasks = sorted(tasks, key=lambda t: calculate_priority(t, today), reverse=True)
    
    # 3. Allocation Tracker
    allocated_hours = {}  # date -> total_hours
    
    # Clear old schedule
    cursor.execute("DELETE FROM schedule")
    
    for task in sorted_tasks:
        current_date = today
        est_minutes = task['est_time'] * 60
        is_scheduled = False
        
        deadline_date = datetime.strptime(task['deadline'], '%Y-%m-%d').date()
        
        # Look ahead up to 21 days
        for _ in range(21):
            date_key = current_date.strftime('%Y-%m-%d')
            day_load = allocated_hours.get(date_key, 0)
            
            # Use force-fit if past deadline
            target_date = deadline_date if current_date > deadline_date else current_date
            
            # Check 5h Cap (300 mins)
            if day_load + est_minutes <= 300:
                # Find valid time window
                start_time = find_time_slot(target_date, est_minutes, current_date == today)
                if start_time:
                    end_time = (datetime.combine(target_date, start_time) + timedelta(minutes=est_minutes)).time()
                    
                    cursor.execute(
                        "INSERT INTO schedule VALUES (?, ?, ?, ?, ?, ?)",
                        (f"{task['id']}_{random.randint(100,999)}", task['id'], target_date.strftime('%Y-%m-%d'), 
                         start_time.strftime('%H:%M'), end_time.strftime('%H:%M'), task['title'])
                    )
                    
                    allocated_hours[date_key] = day_load + est_minutes
                    is_scheduled = True
                    break
            
            current_date += timedelta(days=1)
            
    conn.commit()
    st.toast("Workload reshuffled successfully!")
    st.rerun()

def find_time_slot(date_obj, duration_mins, is_today):
    """
    Finds earliest available time on a day, avoiding college hours (10-17) on weekdays.
    """
    day_type = date_obj.weekday() # 0-4 = Mon-Fri
    is_weekday = day_type < 5
    
    # Search from 07:00 AM or now if today
    if is_today:
        now_time = datetime.now().time()
        start_search = max(time(7, 0), now_time)
    else:
        start_search = time(7, 0)
        
    current_time = datetime.combine(date_obj, start_search)
    day_end = datetime.combine(date_obj, time(23, 30))
    
    while current_time + timedelta(minutes=duration_mins) <= day_end:
        s_time = current_time.time()
        e_time = (current_time + timedelta(minutes=duration_mins)).time()
        
        # Constraint: College Hours 10:00 - 17:00
        conflict = False
        if is_weekday:
            college_start = time(10, 0)
            college_end = time(17, 0)
            if not (e_time <= college_start or s_time >= college_end):
                conflict = True
        
        if not conflict:
            return s_time
            
        current_time += timedelta(minutes=15)
    
    return None

# --- UI TABS ---
tab_dash, tab_tasks, tab_opt, tab_flash, tab_res = st.tabs([
    "📍 Dashboard", "📋 Task Inventory", "⚡ Optimization", "🧠 Flashcards", "📚 Resources"
])

with tab_dash:
    st.title("Academic Engineering Hub")
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.subheader("Dynamic Daily Sequence")
        today_str = datetime.now().strftime('%Y-%m-%d')
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM schedule WHERE scheduled_date = ? ORDER BY start_time", (today_str,))
        today_tasks = cursor.fetchall()
        
        if not today_tasks:
            st.success("No tasks scheduled for today. Enjoy your free time!")
        else:
            for t in today_tasks:
                with st.container(border=True):
                    st.markdown(f"**{t[3]} - {t[4]}**")
                    st.caption(f"Task: {t[5]}")

    with col2:
        st.button("Task Overtime Shuffle", on_click=optimize_schedule, type="primary", use_container_width=True)
        
        # Summary Stats
        cursor.execute("SELECT COUNT(*) FROM tasks WHERE status != 'completed'")
        pending = cursor.fetchone()[0]
        st.metric("Pending Tasks", pending)

with tab_tasks:
    st.subheader("Inventory Management")
    with st.expander("➕ Add New Academic Task"):
        with st.form("task_form"):
            t_title = st.text_input("Course/Task Title")
            t_dl = st.date_input("Deadline")
            t_w = st.slider("Weightage (1-10)", 1, 10, 5)
            t_c = st.slider("Confidence (1-10)", 1, 10, 5)
            t_e = st.number_input("Est. Time (Hours)", 0.5, 10.0, 1.5)
            t_cat = st.selectbox("Category", ["Theory", "Problem Set", "Laboratory", "Project"])
            
            if st.form_submit_button("Log Task"):
                tid = f"task_{random.randint(1000,9999)}"
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (tid, t_title, t_dl.strftime('%Y-%m-%d'), t_w, t_c, t_e, t_cat, 'pending')
                )
                conn.commit()
                st.success("Task Synchronized")
                st.rerun()

    # List tasks
    cursor.execute("SELECT * FROM tasks")
    for r in cursor.fetchall():
        c1, c2, c3 = st.columns([3, 1, 1])
        c1.write(f"**{r[1]}** ({r[6]})")
        c2.write(f"Due: {r[2]}")
        if c3.button("Delete", key=f"del_{r[0]}"):
            cursor.execute("DELETE FROM tasks WHERE id = ?", (r[0],))
            conn.commit()
            st.rerun()

with tab_opt:
    st.header("Algorithmic Engine")
    st.info("The engine reallocates tasks over the next 3 weeks using a multi-day bin packing algorithm. It respects college hours (10 AM - 5 PM) and enforces a strict 5-hour daily study limit.")
    
    if st.button("Run AI Optimization Engine", type="primary"):
        optimize_schedule()
        
    cursor.execute("SELECT * FROM schedule ORDER BY scheduled_date, start_time")
    all_sched = cursor.fetchall()
    
    # Sort for display
    sched_df = pd.DataFrame(all_sched, columns=['id', 'task_id', 'date', 'start', 'end', 'title'])
    for date in sched_df['date'].unique():
        with st.expander(f"📅 {date}"):
            day_data = sched_df[sched_df['date'] == date]
            for _, row in day_data.iterrows():
                st.write(f"**{row['start']} - {row['end']}**: {row['title']}")

with tab_flash:
    st.subheader("Neural Retention System")
    
    # Simple flashcard interface
    with st.form("card_form"):
        f_front = st.text_input("Front (Concept/Question)")
        f_back = st.text_area("Back (Explanation/Answer)")
        if st.form_submit_button("Add Flashcard"):
            fid = f"card_{random.randint(1000,9999)}"
            cursor.execute("INSERT INTO flashcards VALUES (?, ?, ?, ?, ?)", 
                         (fid, f_front, f_back, datetime.now().strftime('%Y-%m-%d'), 1))
            conn.commit()
            st.rerun()
            
    cursor.execute("SELECT * FROM flashcards")
    cards = cursor.fetchall()
    if not cards:
        st.write("No cards created yet.")
    else:
        for c in cards:
            with st.container(border=True):
                st.write(f"**Q:** {c[1]}")
                if st.button("Reveal Answer", key=f"rev_{c[0]}"):
                    st.success(f"**A:** {c[2]}")

with tab_res:
    st.subheader("Link Repository")
    st.write("Central library for PDFs, portal links, and documentation.")
    # Static placeholder for now as per requirements focus
    st.code("https://university-portal.edu/login\nhttps://resource-drive.google.com/engineering-2024")

conn.close()
