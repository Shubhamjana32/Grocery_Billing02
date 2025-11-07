// Data Array - এখন এটি Firebase থেকে আসা ডেটা রাখবে
let transactions = [];
let deletedTransactions = []; // NEW: ডিলিট করা ট্রানজাকশন রাখার জন্য
// Member List 
const members = ["Shubham Jana", "Krishna Kumar", "Suvajit Jana"];
// --- 1. Data Management (Load/Save using Firebase) ---

function loadDeletedTransactions() {
    deletedTransactionsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        deletedTransactions = [];
        if (data) {
            Object.keys(data).forEach(key => {
                deletedTransactions.push({ id: key, ...data[key] });
            });
        }
        renderDeletedHistory();
        console.log("Deleted data loaded from Firebase successfully.");
    }, error => {
        console.error("Firebase read (deleted) failed: ", error);
    });
}

function loadTransactions() {
    // Real-time listener: ডেটাবেসে কোনো পরিবর্তন হলে স্বয়ংক্রিয়ভাবে এই ফাংশনটি চলবে
    transactionsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        transactions = [];
        if (data) {
            // Firebase ডেটা অবজেক্ট থেকে অ্যারেতে রূপান্তর
            Object.keys(data).forEach(key => {
                // key হলো Firebase-এর তৈরি করা ইউনিক ID
                transactions.push({ id: key, ...data[key] }); 
            });
        }
        
        // ডেটা লোড হওয়ার পর UI আপডেট
        renderHistory();
        calculateSettlement();
        loadDeletedTransactions(); // NEW: ডিলিট হওয়া ডেটা লোড করা
        console.log("Data loaded from Firebase successfully.");
    }, error => {
        console.error("Firebase read failed: ", error);
        alert("Failed to load data from server.");
    });
}
// Transaction যোগ করার জন্য ফাংশন
function addTransactionToDB(newTransaction) {
    transactionsRef.push(newTransaction)
        .catch(error => {
            console.error("Error adding transaction: ", error);
            alert("Failed to save data to server.");
        });
}

// --- NEW: Individual Delete Function ---
function deleteTransaction(id) {
    if (confirm("Are you sure you want to delete this specific transaction? It will be moved to the Deleted History.")) {
        // 1. Find the transaction to be deleted
        const transactionToDelete = transactions.find(t => t.id === id);

        if (transactionToDelete) {
            // 2. Add deletion metadata
            const deletedRecord = {
                ...transactionToDelete,
                deletedAt: new Date().toISOString()
            };

            // 3. Move to deleted_transactions node
            deletedTransactionsRef.push(deletedRecord)
                .then(() => {
                    // 4. Remove from transactions node
                    transactionsRef.child(id).remove()
                        .catch(error => {
                            console.error("Error removing transaction: ", error);
                            alert("Failed to remove data from live history.");
                        });
                })
                .catch(error => {
                    console.error("Error saving deleted transaction: ", error);
                    alert("Failed to save data to deleted history.");
                });
        }
    }
}


// --- 2. Expense Entry ---
document.getElementById('expenseForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // 1. Collect Form Data
    const date = document.getElementById('date').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const paidBy = document.getElementById('paidBy').value;
    const description = document.getElementById('description').value;
    
    // Check if Paid By field is empty
    if (!paidBy) {
        alert("Please select who paid for the expense.");
        return;
    }

    // 2. Collect Shared By Data
    const sharedBy = [];
    if (document.getElementById('shareShubhamJana').checked) sharedBy.push('Shubham Jana');
    if (document.getElementById('shareKrishnaKumar').checked) sharedBy.push('Krishna Kumar');
    if (document.getElementById('shareSuvajitJana').checked) sharedBy.push('Suvajit Jana');
    if (sharedBy.length === 0) {
        alert("At least one member must share the cost.");
        return;
    }
    // 3. ডেটাবেসে নতুন ট্রানজাকশন যোগ
    const newTransaction = { date, amount, paidBy, description, sharedBy, timestamp: Date.now() };
    addTransactionToDB(newTransaction); 
    
    // 4. ফর্মটি রিসেট
    this.reset(); 
    // PaidBy field-এ আবার ডিফল্ট খালি অপশন সেট করা
    document.getElementById('paidBy').value = ""; 
});


// --- 3. Settlement Calculation (No change) ---
function calculateSettlement() {
    let totalPaid = {};
    let netBalance = {};
    members.forEach(m => {
        totalPaid[m] = 0;
        netBalance[m] = 0;
    });
    // A. Calculate Total Paid and Net Balance for each member
    transactions.forEach(t => {
        // Total Paid by member
        totalPaid[t.paidBy] += t.amount;
        
        // Calculate individual share for this expense
        const numShared = t.sharedBy.length;
        if (numShared > 0) {
            const sharePerPerson = t.amount / numShared;
            
            // Adjust Net Balance for those who shared the expense
            t.sharedBy.forEach(member => {
                // Member owes their share (negative balance)
                netBalance[member] -= sharePerPerson; 
            });
        }
        
        // The member who paid gets credit (positive balance)
        netBalance[t.paidBy] += t.amount;
    });
    // B. Render Overall Net Result
    const resultDiv = document.getElementById('settlementResult');
    resultDiv.innerHTML = '<h3>Net Balance (Who Owes/Receives)</h3>';
    
    let payers = [];
    let recipients = [];
    let totalExpense = 0;
    members.forEach(member => {
        const balance = netBalance[member];
        const amountDisplay = Math.abs(balance).toFixed(2);
        
        const p = document.createElement('p');
        
        if (balance > 0.01) {
            p.innerHTML = `${member}: Paid ${totalPaid[member].toFixed(2)} Taka. Net Result: <span class="positive">Receives ${amountDisplay} Taka</span>`;
            recipients.push({ name: member, amount: balance });
        } else if (balance < -0.01) {
            p.innerHTML = `${member}: Paid ${totalPaid[member].toFixed(2)} Taka. Net Result: <span class="negative">Owes ${amountDisplay} Taka</span>`;
            payers.push({ name: member, amount: Math.abs(balance) });
        } else {
            p.textContent = `${member}: Paid ${totalPaid[member].toFixed(2)} Taka. Net Result: Neutral.`;
        }
        resultDiv.appendChild(p);
        
        totalExpense += totalPaid[member];
    });
    
    // Add total expense for context
    const totalP = document.createElement('p');
    totalP.innerHTML = `<strong>Total Group Expense: ${totalExpense.toFixed(2)} Taka</strong>`;
    resultDiv.prepend(totalP);
    // C. Calculate and Render payment instructions
    renderPaymentInstructions(payers, recipients);
}

// Function to simplify the "Who pays whom" (No change)
function renderPaymentInstructions(payers, recipients) {
    const instructionsDiv = document.getElementById('paymentInstructions');
    instructionsDiv.innerHTML = '<h3>Simplified Payment Instructions</h3>';
    
    const ul = document.createElement('ul');
    instructionsDiv.appendChild(ul);
    
    if (payers.length === 0 && recipients.length === 0) {
        ul.innerHTML = '<li>All accounts are settled!</li>';
        return;
    }
    
    payers.sort((a, b) => b.amount - a.amount);
    recipients.sort((a, b) => b.amount - a.amount);
    
    let i = 0; 
    let j = 0; 
    while (i < payers.length && j < recipients.length) {
        const payer = payers[i];
        const recipient = recipients[j];
        const amountToTransfer = Math.min(payer.amount, recipient.amount);
        
        if (amountToTransfer > 0.01) {
            const li = document.createElement('li');
            li.textContent = `${payer.name} pays ${recipient.name} ${amountToTransfer.toFixed(2)} Taka.`;
            ul.appendChild(li);
        }
        payer.amount -= amountToTransfer;
        recipient.amount -= amountToTransfer;
        if (payer.amount < 0.01) {
            i++;
        }
        if (recipient.amount < 0.01) {
            j++;
        }
    }
}
// --- 4. History Display ---
function renderHistory() {
    const table = document.getElementById('historyTable');
    // Clear old data and add headers
    table.innerHTML = `<tr><th>Date</th><th>Description</th><th>Amount</th><th>Paid By</th><th>Shared By</th><th>Action</th></tr>`; // NEW: Action column
    
    // Sort transactions by timestamp (newest first)
    transactions.sort((a, b) => b.timestamp - a.timestamp); 
    transactions.forEach(t => {
        const row = table.insertRow();
        row.insertCell().textContent = t.date;
        row.insertCell().textContent = t.description;
        row.insertCell().textContent = t.amount.toFixed(2);
        row.insertCell().textContent = t.paidBy;
        row.insertCell().textContent = t.sharedBy ? t.sharedBy.join(', ') : ''; 

        // NEW: Delete Button Cell
        const actionCell = row.insertCell();
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'delete-transaction-btn';
        deleteBtn.onclick = () => deleteTransaction(t.id);
        actionCell.appendChild(deleteBtn);
    });
}

// --- NEW: Deleted History Display ---
function renderDeletedHistory() {
    const table = document.getElementById('deletedHistoryTable');
    // Clear old data and add headers
    table.innerHTML = `<tr><th>Date</th><th>Description</th><th>Amount</th><th>Paid By</th><th>Deleted At</th></tr>`;
    
    // Sort deleted transactions by deletion timestamp (newest first)
    deletedTransactions.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt)); 
    deletedTransactions.forEach(t => {
        const row = table.insertRow();
        row.insertCell().textContent = t.date;
        row.insertCell().textContent = t.description;
        row.insertCell().textContent = t.amount ? t.amount.toFixed(2) : 'N/A';
        row.insertCell().textContent = t.paidBy;
        row.insertCell().textContent = new Date(t.deletedAt).toLocaleDateString() + ' ' + new Date(t.deletedAt).toLocaleTimeString();
    });
}

// --- NEW: Clear Deleted History Function ---
function clearDeletedHistory() {
    if (confirm("Are you sure you want to permanently clear the deleted transaction history? This cannot be undone.")) {
        deletedTransactionsRef.remove()
            .then(() => {
                alert("Deleted History has been cleared.");
            })
            .catch(error => {
                console.error("Error clearing deleted data: ", error);
                alert("Failed to clear deleted history.");
            });
    }
}

// --- 5. Utility Functions (Clear All Data - Live Transactions) ---
function clearAllData() {
    if (confirm("Are you sure you want to clear ALL live transaction data? This cannot be undone.")) {
        // Firebase থেকে সব ডেটা সরিয়ে দিন
        transactionsRef.remove()
            .then(() => {
                alert("All live data has been cleared from the database.");
            })
            .catch(error => {
                console.error("Error clearing data: ", error);
                alert("Failed to clear data.");
            });
    }
}

// --- 6. Initialization ---
function init() {
    // Firebase listener সেটআপ হবে এবং ডেটা লোড হয়ে UI আপডেট হবে
    loadTransactions(); 
}
init();
