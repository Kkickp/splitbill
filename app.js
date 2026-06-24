document.addEventListener('DOMContentLoaded', () => {
    // Safe DOM element retrieval
    const receiptDiscountInput = document.getElementById('receiptDiscount');
    
    const extraFeesList = document.getElementById('extraFeesList');
    const addExtraFeeBtn = document.getElementById('addExtraFeeBtn');
    
    const personsList = document.getElementById('personsList');
    const addPersonBtn = document.getElementById('addPersonBtn');
    
    const calculateBtn = document.getElementById('calculateBtn');
    const calcBtnText = document.getElementById('calcBtnText');
    const calcSpinner = document.getElementById('calcSpinner');
    
    const resultSection = document.getElementById('resultSection');
    const resultContent = document.getElementById('resultContent');

    // Dynamic Extra Fees Form
    const createExtraFeeItem = () => {
        const div = document.createElement('div');
        div.className = 'person-item'; // Reuse existing CSS grid for row styling
        div.innerHTML = `
            <input type="text" class="extra-fee-name" placeholder="Nama Biaya (mis: Pajak)" required>
            <input type="number" class="extra-fee-amount" placeholder="Nominal (mis: 15000)" min="0" required>
            <button type="button" class="remove-person-btn remove-fee-btn" aria-label="Hapus">&times;</button>
        `;
        
        div.querySelector('.remove-fee-btn').addEventListener('click', () => {
            div.remove();
        });
        
        return div;
    };

    if (addExtraFeeBtn) {
        addExtraFeeBtn.addEventListener('click', () => {
            if (extraFeesList) {
                extraFeesList.appendChild(createExtraFeeItem());
            }
        });
    }

    // Dynamic Persons Form
    const createPersonItem = () => {
        const div = document.createElement('div');
        div.className = 'person-item';
        div.innerHTML = `
            <input type="text" class="person-name" placeholder="Nama (mis: Budi)" required>
            <input type="number" class="person-subtotal" placeholder="Total Harga Makanan (mis: 50000)" min="0" required>
            <button type="button" class="remove-person-btn" aria-label="Hapus">&times;</button>
        `;
        
        div.querySelector('.remove-person-btn').addEventListener('click', () => {
            if (personsList && personsList.children.length > 1) {
                div.remove();
            } else {
                alert('Minimal harus ada 1 orang.');
            }
        });
        
        return div;
    };

    if (addPersonBtn) {
        addPersonBtn.addEventListener('click', () => {
            if (personsList) {
                personsList.appendChild(createPersonItem());
            }
        });
    }

    // Add initial remove listener for persons safely
    const initialRemovePersonBtn = document.querySelector('#personsList .remove-person-btn');
    if (initialRemovePersonBtn) {
        initialRemovePersonBtn.addEventListener('click', function() {
            if (personsList && personsList.children.length > 1) {
                this.parentElement.remove();
            } else {
                alert('Minimal harus ada 1 orang.');
            }
        });
    }

    // Format Currency IDR
    const formatIDR = (number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(number);
    };

    // Calculate Button Handler
    if (calculateBtn) {
        calculateBtn.addEventListener('click', () => {
            // Get Fixed Discount
            const discount = receiptDiscountInput ? (parseFloat(receiptDiscountInput.value) || 0) : 0;

            // Get Dynamic Extra Fees
            const extraFees = [];
            let totalExtraFees = 0;
            let isExtraFeesValid = true;

            document.querySelectorAll('#extraFeesList .person-item').forEach(item => {
                const nameInput = item.querySelector('.extra-fee-name');
                const amountInput = item.querySelector('.extra-fee-amount');
                if (!nameInput || !amountInput) return;

                const name = nameInput.value.trim();
                const amount = parseFloat(amountInput.value.trim());

                if (!name || isNaN(amount) || amount < 0) {
                    isExtraFeesValid = false;
                } else {
                    totalExtraFees += amount;
                    extraFees.push({ name, amount });
                }
            });

            if (!isExtraFeesValid) {
                alert('Tolong lengkapi nama dan nominal untuk semua biaya tambahan lainnya.');
                return;
            }

            // Collect Orders
            const people = [];
            let totalSubtotal = 0;
            let isFormValid = true;

            document.querySelectorAll('#personsList .person-item').forEach(item => {
                const nameInput = item.querySelector('.person-name');
                const subtotalInput = item.querySelector('.person-subtotal');
                if (!nameInput || !subtotalInput) return;

                const name = nameInput.value.trim();
                const subtotal = parseFloat(subtotalInput.value.trim());

                if (!name || isNaN(subtotal) || subtotal < 0) {
                    isFormValid = false;
                } else {
                    totalSubtotal += subtotal;
                    people.push({ name, person_subtotal: subtotal });
                }
            });

            if (!isFormValid || people.length === 0) {
                alert('Tolong isi semua nama dan pastikan harga makanan berupa angka yang valid.');
                return;
            }

            if (totalSubtotal === 0 && (discount > 0 || totalExtraFees > 0)) {
                 alert('Subtotal semua makanan adalah 0. Tidak bisa membagi diskon/biaya lainnya.');
                 return;
            }

            // Setup UI for Loading
            calculateBtn.disabled = true;
            if (calcBtnText) calcBtnText.textContent = 'Menghitung...';
            if (calcSpinner) calcSpinner.classList.remove('hidden');
            if (resultSection) resultSection.classList.add('hidden');

            try {
                // Calculate proportional shares
                const calculatedPeople = people.map(person => {
                    const proportion = totalSubtotal > 0 ? person.person_subtotal / totalSubtotal : 0;
                    
                    const discount_share = discount * proportion;
                    
                    let person_extra_fees = [];
                    let total_person_extra_fee = 0;
                    
                    extraFees.forEach(fee => {
                        const fee_share = fee.amount * proportion;
                        total_person_extra_fee += fee_share;
                        person_extra_fees.push({
                            name: fee.name,
                            share: fee_share
                        });
                    });
                    
                    const total_to_pay = person.person_subtotal + total_person_extra_fee - discount_share;

                    return {
                        ...person,
                        proportion_percentage: proportion * 100,
                        discount_share,
                        extra_fees_breakdown: person_extra_fees,
                        total_to_pay
                    };
                });

                const summary = {
                    subtotal: totalSubtotal,
                    discount: discount,
                    extraFeesList: extraFees,
                    total_extra_fees: totalExtraFees,
                    total: totalSubtotal + totalExtraFees - discount
                };

                const resultData = { summary, people: calculatedPeople };
                
                setTimeout(() => {
                    renderResult(resultData);
                    calculateBtn.disabled = false;
                    if (calcBtnText) calcBtnText.textContent = 'Hitung Tagihan';
                    if (calcSpinner) calcSpinner.classList.add('hidden');
                }, 300);

            } catch (error) {
                console.error(error);
                alert('Terjadi kesalahan: ' + error.message);
                calculateBtn.disabled = false;
                if (calcBtnText) calcBtnText.textContent = 'Hitung Tagihan';
                if (calcSpinner) calcSpinner.classList.add('hidden');
            }
        });
    }

    function renderResult(data) {
        if (!resultContent || !resultSection) return;
        resultContent.innerHTML = '';

        // Render Summary
        const summaryDiv = document.createElement('div');
        summaryDiv.style.marginBottom = '1.5rem';
        
        let extraFeesHtml = data.summary.extraFeesList.map(fee => 
            `<div class="receipt-item"><span>${fee.name}</span> <span>${formatIDR(fee.amount)}</span></div>`
        ).join('');

        summaryDiv.innerHTML = `
            <div class="receipt-item"><span>Subtotal Makanan (Otomatis)</span> <span>${formatIDR(data.summary.subtotal)}</span></div>
            ${extraFeesHtml}
            ${data.summary.discount ? `<div class="receipt-item" style="color:var(--danger);"><span>Diskon</span> <span>-${formatIDR(data.summary.discount)}</span></div>` : ''}
            <div class="receipt-total"><span>TOTAL KESELURUHAN</span> <span>${formatIDR(data.summary.total)}</span></div>
        `;
        resultContent.appendChild(summaryDiv);

        // Render per person
        data.people.forEach(person => {
            const personDiv = document.createElement('div');
            personDiv.className = 'person-bill';
            
            let personExtraFeesHtml = person.extra_fees_breakdown.map(fee => {
                if (fee.share > 0) {
                    return `<div style="display:flex; justify-content:space-between;">Porsi ${fee.name}: <span>${formatIDR(fee.share)}</span></div>`;
                }
                return '';
            }).join('');

            personDiv.innerHTML = `
                <h3>👤 ${person.name}</h3>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem; display:flex; flex-direction:column; gap:0.25rem;">
                    <div style="display:flex; justify-content:space-between;">Harga Makanan: <span>${formatIDR(person.person_subtotal)}</span></div>
                    ${personExtraFeesHtml}
                    ${person.discount_share > 0 ? `<div style="display:flex; justify-content:space-between; color:var(--danger);">Porsi Diskon: <span>-${formatIDR(person.discount_share)}</span></div>` : ''}
                </div>
                <div class="person-bill-total">
                    <span>Total Harus Dibayar</span>
                    <span>${formatIDR(person.total_to_pay)}</span>
                </div>
            `;
            resultContent.appendChild(personDiv);
        });

        resultSection.classList.remove('hidden');
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }
});
