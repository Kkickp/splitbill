document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const apiKeyInput = document.getElementById('apiKey');
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('receiptImage');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const removeImageBtn = document.getElementById('removeImageBtn');
    
    const personsList = document.getElementById('personsList');
    const addPersonBtn = document.getElementById('addPersonBtn');
    
    const calculateBtn = document.getElementById('calculateBtn');
    const calcBtnText = document.getElementById('calcBtnText');
    const calcSpinner = document.getElementById('calcSpinner');
    
    const resultSection = document.getElementById('resultSection');
    const resultContent = document.getElementById('resultContent');

    // State
    let currentImageBase64 = null;
    let currentImageMimeType = null;

    // Load API Key from LocalStorage
    const savedApiKey = localStorage.getItem('geminiApiKey');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }

    // Save API Key on change
    apiKeyInput.addEventListener('change', (e) => {
        localStorage.setItem('geminiApiKey', e.target.value.trim());
    });

    // File Upload Handlers
    const handleFiles = (files) => {
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                currentImageMimeType = file.type;
                const reader = new FileReader();
                reader.onload = (e) => {
                    currentImageBase64 = e.target.result.split(',')[1];
                    imagePreview.src = e.target.result;
                    dropArea.classList.add('hidden');
                    imagePreviewContainer.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            } else {
                alert('Tolong unggah file gambar (JPG/PNG).');
            }
        }
    };

    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    removeImageBtn.addEventListener('click', () => {
        currentImageBase64 = null;
        fileInput.value = '';
        imagePreviewContainer.classList.add('hidden');
        dropArea.classList.remove('hidden');
    });

    // Drag and Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false);
    });

    dropArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        handleFiles(dt.files);
    });

    // Dynamic Persons Form
    const createPersonItem = () => {
        const div = document.createElement('div');
        div.className = 'person-item';
        div.innerHTML = `
            <input type="text" class="person-name" placeholder="Nama (mis: Budi)" required>
            <input type="text" class="person-orders" placeholder="Pesanan (mis: Nasi Goreng, Es Teh)" required>
            <button class="remove-person-btn" aria-label="Hapus">&times;</button>
        `;
        
        div.querySelector('.remove-person-btn').addEventListener('click', () => {
            if (personsList.children.length > 1) {
                div.remove();
            } else {
                alert('Minimal harus ada 1 orang.');
            }
        });
        
        return div;
    };

    addPersonBtn.addEventListener('click', () => {
        personsList.appendChild(createPersonItem());
    });

    // Add initial remove listener
    document.querySelector('.remove-person-btn').addEventListener('click', function() {
        if (personsList.children.length > 1) {
            this.parentElement.remove();
        } else {
            alert('Minimal harus ada 1 orang.');
        }
    });

    // Format Currency IDR
    const formatIDR = (number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(number);
    };

    // Calculate Button Handler
    calculateBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            alert('Tolong masukkan Gemini API Key terlebih dahulu.');
            return;
        }

        if (!currentImageBase64) {
            alert('Tolong unggah foto nota terlebih dahulu.');
            return;
        }

        // Collect Orders
        const orders = [];
        let isFormValid = true;
        document.querySelectorAll('.person-item').forEach(item => {
            const name = item.querySelector('.person-name').value.trim();
            const items = item.querySelector('.person-orders').value.trim();
            if (!name || !items) {
                isFormValid = false;
            } else {
                orders.push({ name, items });
            }
        });

        if (!isFormValid || orders.length === 0) {
            alert('Tolong isi semua nama dan pesanan.');
            return;
        }

        // Setup UI for Loading
        calculateBtn.disabled = true;
        calcBtnText.textContent = 'Menghitung...';
        calcSpinner.classList.remove('hidden');
        resultSection.classList.add('hidden');

        try {
            await processWithGemini(apiKey, currentImageBase64, currentImageMimeType, orders);
        } catch (error) {
            console.error(error);
            alert('Terjadi kesalahan: ' + error.message);
        } finally {
            calculateBtn.disabled = false;
            calcBtnText.textContent = 'Hitung Tagihan';
            calcSpinner.classList.add('hidden');
        }
    });

    async function processWithGemini(apiKey, base64Image, mimeType, orders) {
        const modelName = 'gemini-2.5-flash';
        const promptText = `
Anda adalah sistem ahli kalkulator tagihan (split bill) restoran yang presisi.
Tugas Anda adalah membaca nota restoran dari gambar yang diberikan dan membagi tagihan sesuai dengan pesanan tiap orang.
Penting: Cocokkan pesanan (teks dari user) dengan item yang ada di nota dengan cara cerdas (meskipun ada typo atau singkatan).

Berikut adalah daftar orang dan apa yang mereka pesan:
${JSON.stringify(orders, null, 2)}

Instruksi Perhitungan:
1. Identifikasi harga setiap item dari nota yang cocok dengan pesanan masing-masing orang.
2. Identifikasi Total Subtotal, Pajak (Tax), dan Biaya Layanan (Service Charge) dari nota. Diskon jika ada.
3. Hitung proporsi masing-masing orang berdasarkan subtotal pesanan mereka terhadap total subtotal nota.
4. Bagikan pajak, biaya layanan, dan diskon secara proporsional sesuai persentase subtotal masing-masing orang.
5. Hitung TOTAL AKHIR yang harus dibayar oleh tiap orang.
6. Keluarkan hasil DALAM FORMAT JSON SAJA (tanpa backticks markdown atau penjelasan lain, MURNI STRING JSON) dengan skema berikut:
{
  "summary": {
    "subtotal": 0,
    "tax": 0,
    "service_charge": 0,
    "discount": 0,
    "total": 0
  },
  "people": [
    {
      "name": "string",
      "matched_items": [
        {"name_on_receipt": "string", "price": 0}
      ],
      "person_subtotal": 0,
      "proportion_percentage": 0,
      "tax_share": 0,
      "service_charge_share": 0,
      "discount_share": 0,
      "total_to_pay": 0
    }
  ]
}
Pastikan perhitungan matematis akurat.
`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: promptText },
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Image
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Gagal terhubung ke Gemini API');
        }

        const data = await response.json();
        const jsonString = data.candidates[0].content.parts[0].text;
        
        let resultJson;
        try {
            resultJson = JSON.parse(jsonString);
        } catch (e) {
            // Coba bersihkan kalau ada markdown
            const cleanJson = jsonString.replace(/```json\n?|\n?```/g, '').trim();
            resultJson = JSON.parse(cleanJson);
        }

        renderResult(resultJson);
    }

    function renderResult(data) {
        resultContent.innerHTML = '';

        // Render Summary
        const summaryDiv = document.createElement('div');
        summaryDiv.style.marginBottom = '1.5rem';
        summaryDiv.innerHTML = `
            <div class="receipt-item"><span>Subtotal Nota</span> <span>${formatIDR(data.summary.subtotal)}</span></div>
            <div class="receipt-item"><span>Pajak (Tax)</span> <span>${formatIDR(data.summary.tax)}</span></div>
            <div class="receipt-item"><span>Service Charge</span> <span>${formatIDR(data.summary.service_charge)}</span></div>
            ${data.summary.discount ? `<div class="receipt-item"><span>Diskon</span> <span>-${formatIDR(data.summary.discount)}</span></div>` : ''}
            <div class="receipt-total"><span>TOTAL KESELURUHAN</span> <span>${formatIDR(data.summary.total)}</span></div>
        `;
        resultContent.appendChild(summaryDiv);

        // Render per person
        data.people.forEach(person => {
            const personDiv = document.createElement('div');
            personDiv.className = 'person-bill';
            
            let itemsHtml = person.matched_items.map(item => 
                `<div>${item.name_on_receipt} <span style="float:right">${formatIDR(item.price)}</span></div>`
            ).join('');

            personDiv.innerHTML = `
                <h3>👤 ${person.name}</h3>
                <div class="item-list">
                    ${itemsHtml}
                </div>
                <hr style="border:0; border-top: 1px dashed rgba(255,255,255,0.2); margin: 0.8rem 0;">
                <div style="font-size: 0.85rem; color: #94a3b8;">
                    <div style="display:flex; justify-content:space-between;">Subtotal: <span>${formatIDR(person.person_subtotal)}</span></div>
                    ${person.tax_share ? `<div style="display:flex; justify-content:space-between;">Porsi Pajak: <span>${formatIDR(person.tax_share)}</span></div>` : ''}
                    ${person.service_charge_share ? `<div style="display:flex; justify-content:space-between;">Porsi Service: <span>${formatIDR(person.service_charge_share)}</span></div>` : ''}
                    ${person.discount_share ? `<div style="display:flex; justify-content:space-between; color:#ef4444;">Porsi Diskon: <span>-${formatIDR(person.discount_share)}</span></div>` : ''}
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
