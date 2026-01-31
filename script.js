// ★ APIのURL設定
const API_URL = "https://script.google.com/macros/s/AKfycby-JjmXn6fktJ4fGg34iUPadhux-MdFDxp_ei83XgWLiW-xdnArfQc2I6DwT0tox0y9/exec";

let isFormDirty = false;
const formElementsToTrack = ['workDate', 'staffCode'];

const cancellationDetails = document.getElementById('cancellationDetails');
const reportSetsContainer = document.getElementById('reportSetsContainer');
const addSetButton = document.getElementById('addSetButton');
const submitButton = document.getElementById('submitReport');
// リセットボタン削除に伴い変数削除
const popupOverlay = document.getElementById('popupOverlay');
const popupContent = document.getElementById('popupContent');
const messageBox = document.getElementById('messageBox');
const popupMessage = document.getElementById('popupMessage');
const hankoContainer = document.getElementById('hankoContainer');
const hankoMessage = document.getElementById('hankoMessage');
const popupResults = document.getElementById('popupResults');
const closePopup = document.getElementById('closePopup');

const showSearchPopupButton = document.getElementById('showSearchPopup');
const searchPopupOverlay = document.getElementById('searchPopupOverlay');
const executeSearchButton = document.getElementById('executeSearch');
const closeSearchPopup = document.getElementById('closeSearchPopup');
// 確認ポップアップ関連削除

const scannerPopup = document.getElementById('scanner-popup');
const scannerVideo = document.getElementById('scanner-video');
const closeScannerButton = document.getElementById('close-scanner');
let codeReader = null;
let currentScannerTargetInput = null;

const maxRows = 50;
const maxReportSets = 10;

function markFormDirty() { isFormDirty = true; }

function preparePopup() {
    popupContent.className = 'popup-content-style';
    messageBox.classList.remove('hidden');
    hankoContainer.classList.add('hidden');
    popupResults.innerHTML = '';
    popupContent.classList.remove('hanko-success', 'error', 'loading');
}

document.addEventListener('DOMContentLoaded', () => {
    const workDateInput = document.getElementById('workDate');
    if (workDateInput) {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        workDateInput.value = `${y}-${m}-${d}`;
    }

    // ★修正: 前回保存した担当者コードを読み込む
    const savedStaffCode = localStorage.getItem('savedStaffCode');
    if (savedStaffCode) { document.getElementById('staffCode').value = savedStaffCode; }

    const hasChangeRadios = document.querySelectorAll('input[name="hasChange"]');
    const initialValue = document.querySelector('input[name="hasChange"]:checked').value;
    toggleChangeDetails(initialValue);

    hasChangeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            toggleChangeDetails(e.target.value);
            markFormDirty();
        });
    });

    const staffCodeInput = document.getElementById('staffCode');
    staffCodeInput.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
        markFormDirty();
    });
});

function toggleChangeDetails(value) {
    const isHidden = value === 'なし';
    cancellationDetails.classList.toggle('hidden', isHidden);
    addSetButton.classList.toggle('hidden', isHidden);
    if (isHidden) {
        reportSetsContainer.innerHTML = '';
        addReportSet();
    } else {
        if (reportSetsContainer.children.length === 0) {
            addReportSet();
        }
    }
}

function addReportSet() {
    if (reportSetsContainer.children.length >= maxReportSets) {
        alert('変更報告は最大10件までです。');
        return;
    }

    const setIndex = reportSetsContainer.children.length;
    const newReportSet = document.createElement('div');
    newReportSet.className = 'report-set';
    newReportSet.dataset.customerName = "";
    
    newReportSet.innerHTML = `
      <label class="input-label" for="orderNumber_${setIndex}">受注番号下６桁を入力<br>又はカメラでQR受注番号を<br>読み取ってください:</label>
      <div class="order-number-group">
        <input type="text" name="orderNumber[]" id="orderNumber_${setIndex}" 
               pattern="^([0-9]{6}|[0-9]{15})$" 
               title="6桁または15桁の数字" maxlength="15" 
               inputmode="numeric" placeholder="8****">
        <button type="button" class="camera-btn">📸</button>
      </div>
      <div class="customer-name-display"></div>
      
      <div class="report-set-options">
        <div class="option-group">
          <label class="input-label">区分:</label>
          <select name="scope[]" class="scope-select">
            <option value="" disabled selected>区分を選択</option>
            <option value="一部">一部</option>
            <option value="全部">全部</option>
          </select>
        </div>
        <div class="option-group">
          <label class="input-label">理由:</label>
          <select name="mainReason[]" class="main-reason-select">
            <option value="" disabled selected>理由を選択</option>
            <option value="日延べ">日延べ</option>
            <option value="キャンセル">キャンセル</option>
            <option value="機種変更">機種変更</option>
          </select>
        </div>
      </div>
      
      <div class="row-input-section">
        <label class="input-label">行ってない行を記載してください<br>（指示書左側の数字を参照）:</label>
        <div class="row-container">
          <div class="row-input">
            <input type="text" name="cancelRows[${setIndex}][]" pattern="^[0-9]{1,2}$" 
                   maxlength="2" inputmode="numeric" placeholder="行">
            <span class="row-suffix"> 行目</span>
            <button type="button" class="add-next-row-button">次を追加</button>
          </div>
        </div>
      </div>
    `;
    reportSetsContainer.appendChild(newReportSet);
    
    const orderInput = newReportSet.querySelector('input[name="orderNumber[]"]');
    orderInput.addEventListener('input', function() {
         this.value = this.value.replace(/[^0-9]/g, '');
         if (this.value.length === 15) { this.blur(); }
         markFormDirty();
    });
    const scopeSelect = newReportSet.querySelector('.scope-select');
    scopeSelect.addEventListener('change', function() {
        toggleRowInputVisibility(this);
        markFormDirty();
    });
    toggleRowInputVisibility(scopeSelect);
}

function checkDuplicateRow(input) {
    const val = input.value;
    if (!val) return;
    
    const container = input.closest('.row-container');
    const allInputs = container.querySelectorAll('input[name*="cancelRows"]');
    let isDupe = false;
    allInputs.forEach(other => {
        if (other !== input && other.value === val) {
            isDupe = true;
        }
    });
    if (isDupe) {
        preparePopup();
        popupMessage.textContent = '同じ行が入力されました';
        popupContent.classList.add('error');
        popupOverlay.classList.remove('hidden');
        input.classList.add('input-error');
        input.value = ''; 
    } else {
        input.classList.remove('input-error');
    }
}

reportSetsContainer.addEventListener('click', function(e) {
    if (e.target.classList.contains('add-next-row-button')) {
        const btn = e.target;
        const container = btn.closest('.row-container');
        const currentInputs = container.querySelectorAll('.row-input');
        
        if (currentInputs.length >= maxRows) { alert('最大50行までです'); return; }

        const currentInput = btn.previousElementSibling.previousElementSibling;
        if (currentInput.value === '') { currentInput.focus(); return; }

        const div = document.createElement('div');
        div.className = 'row-input';
        const setIndex = Array.from(reportSetsContainer.children).indexOf(btn.closest('.report-set'));
        div.innerHTML = 
        `
            <input type="text" name="cancelRows[${setIndex}][]" pattern="^[0-9]{1,2}$" maxlength="2" inputmode="numeric" placeholder="行">
            <span class="row-suffix"> 行目</span>
            <button type="button" class="add-next-row-button">次を追加</button>
        `;
        container.appendChild(div);
        div.querySelector('input').focus();
    }
    
    if (e.target.closest('.camera-btn')) {
        const input = e.target.closest('.order-number-group').querySelector('input');
        startScanner(input);
    }
});

reportSetsContainer.addEventListener('focusout', function(e) {
    if (e.target.matches('.row-input input')) {
        const input = e.target;
        const rowDiv = input.closest('.row-input');
        const container = rowDiv.closest('.row-container');
        if (container.querySelectorAll('.row-input').length > 1 && 
            rowDiv !== container.lastElementChild 
            && input.value === '') {
            rowDiv.remove();
        }
    }
});
reportSetsContainer.addEventListener('change', function(e) {
     if (e.target.matches('.row-input input')) {
         checkDuplicateRow(e.target);
     }
});
addSetButton.addEventListener('click', addReportSet);

function toggleRowInputVisibility(selectElement) {
    const reportSet = selectElement.closest('.report-set');
    const rowSection = reportSet.querySelector('.row-input-section');
    const inputs = rowSection.querySelectorAll('input');
    
    const isAll = selectElement.value === '全部';
    rowSection.classList.toggle('hidden', isAll);
    inputs.forEach(input => input.disabled = isAll);
    if (isAll) {
         const container = rowSection.querySelector('.row-container');
         container.innerHTML = ''; 
         const setIndex = Array.from(reportSetsContainer.children).indexOf(reportSet);
         container.innerHTML = `<div class="row-input"><input type="text" name="cancelRows[${setIndex}][]" disabled><span class="row-suffix"> 行目</span><button type="button" class="add-next-row-button">次を追加</button></div>`;
    }
}

function showError(input, msg) {
    const parent = input.closest('.form-group') ||
    input.closest('.report-set') || input.parentElement;
    const exist = parent.querySelector('.error-message');
    if (exist) exist.remove();
    
    input.classList.add('input-error');
    const d = document.createElement('div');
    d.className = 'error-message';
    d.textContent = msg;
    
    if(input.tagName === 'TEXTAREA') {
        input.parentNode.insertBefore(d, input.nextSibling);
    } else {
        parent.appendChild(d);
    }
    input.scrollIntoView({behavior:'smooth', block:'center'});
    input.focus();
}

function clearAllErrors() {
    document.querySelectorAll('.input-error').forEach(e => e.classList.remove('input-error'));
    document.querySelectorAll('.error-message').forEach(e => e.remove());
}

submitButton.addEventListener('click', function() {
    clearAllErrors();
    const workDate = document.getElementById('workDate').value;
    const staffCode = document.getElementById('staffCode').value;
    const hasChange = document.querySelector('input[name="hasChange"]:checked').value;
    const overallComment = document.getElementById('overallComment').value;

    if (!workDate) return showError(document.getElementById('workDate'), '日付を入力してください');
    if (!staffCode) return showError(document.getElementById('staffCode'), '担当者コードを入力してください');
    if (!/^8[0-9]{3,4}$/.test(staffCode)) return showError(document.getElementById('staffCode'), '担当者コードが正しくありません(8から始まる4桁または5桁)');


    let reportData = [];
    let hasError = false;

    if (hasChange === 'あり') {
        const sets = document.querySelectorAll('.report-set');
        sets.forEach((set, i) => {
            if (hasError) return;
            const orderNum = set.querySelector('input[name="orderNumber[]"]').value;
            const scope = set.querySelector('.scope-select').value;
            const reason = set.querySelector('.main-reason-select').value;
            
            const rowInputs = set.querySelectorAll('.row-container input:not([disabled])');
            let rows = [];
            rowInputs.forEach(inp => { if(inp.value) rows.push(inp.value); });

            // コメント以外の項目で空チェック
            if (!orderNum && !scope && !reason) return;
            
            if (!orderNum) { showError(set.querySelector('input[name="orderNumber[]"]'), '受注番号を入力してください'); hasError=true; return; }
            if (!scope) { showError(set.querySelector('.scope-select'), '区分を選択してください');
            hasError=true; return; }
            if (!reason) { showError(set.querySelector('.main-reason-select'), '理由を選択してください');
            hasError=true; return; }
            if (scope === '一部' && rows.length === 0) {
                showError(set.querySelector('.row-input input'), '行ってない行を入力してください');
            hasError=true; return;
            }

            reportData.push({
                orderNumber: orderNum,
                scope: scope,
                mainReason: reason,
                cancelRows: rows,
                customerName: set.dataset.customerName || ''
            });
        });
    }
    
    if (hasError) return;

    // ★修正: 送信成功時に担当者コードを保存する
    localStorage.setItem('savedStaffCode', staffCode);

    submitButton.disabled = true;
    submitButton.textContent = '送信中...';

    const payload = {
        workDate: workDate,
        staffCode: staffCode,
        hasChange: hasChange,
        comment: overallComment, 
        reports: reportData
    };

    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success') {
            preparePopup();
            hankoContainer.classList.remove('hidden');
            popupContent.classList.add('hanko-success');
            hankoMessage.textContent = '安心してください！送信できました！！';
            popupOverlay.classList.remove('hidden');
            submitButton.disabled = false;
            submitButton.textContent = '完了報告を送信 📤';
            isFormDirty = false;
            resetFormFields(); 
        } else {
            throw new Error(result.message || '送信エラー');
        }
    })
    .catch((e) => {
        preparePopup();
        popupContent.classList.add('error');
        popupMessage.textContent = '送信に失敗しました。';
        popupOverlay.classList.remove('hidden');
        submitButton.disabled = false;
        submitButton.textContent = '完了報告を送信 📤';
        console.error(e);
    });
});

// リセットボタンのイベントリスナー削除

function resetFormFields() {
    document.getElementById('workDate').value = '';
    // 担当者コードはクリアするが、直後に保存値を読み込むことで「記憶」を実現
    document.getElementById('staffCode').value = '';
    document.querySelector('input[name="hasChange"][value="なし"]').checked = true;
    document.getElementById('overallComment').value = '';
    
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    document.getElementById('workDate').value = `${y}-${m}-${d}`;
    
    // ★修正: リセット後も担当者コードを復元
    const saved = localStorage.getItem('savedStaffCode');
    if(saved) document.getElementById('staffCode').value = saved;
    
    toggleChangeDetails('なし');
    clearAllErrors();
    isFormDirty = false;
}

showSearchPopupButton.addEventListener('click', () => {
    searchPopupOverlay.classList.remove('hidden');
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    document.getElementById('popupSearchDate').value = `${y}-${m}-${d}`;
    
    // ★検索ポップアップにも保存されたコードを適用（任意）
    const saved = localStorage.getItem('savedStaffCode');
    if(saved) document.getElementById('popupSearchStaffCode').value = saved;
});
closeSearchPopup.addEventListener('click', () => searchPopupOverlay.classList.add('hidden'));

executeSearchButton.addEventListener('click', () => {
    const date = document.getElementById('popupSearchDate').value;
    const code = document.getElementById('popupSearchStaffCode').value;
    if(!date || !code) return alert('検索日と担当者コードを入力してください');
    
    searchPopupOverlay.classList.add('hidden');
    preparePopup();
    popupMessage.textContent = '検索中...';
    popupOverlay.classList.remove('hidden');
    
    const queryString = new URLSearchParams({
        action: 'search',
        date: date,
        staffCode: code
    }).toString();

    fetch(`${API_URL}?${queryString}`)
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success') {
            displaySearchResults(result.data);
        } else {
            throw new Error(result.message);
        }
    })
    .catch(() => {
        popupMessage.textContent = '検索エラー';
        popupContent.classList.add('error');
    });
});

function displaySearchResults(results) {
    preparePopup();
    popupMessage.textContent = results.length ? '検索結果' : '該当なし';
    popupResults.classList.remove('hidden');
    if (results.length === 0) {
        popupResults.innerHTML = '<p>報告は見つかりませんでした。</p>';
        return;
    }
    
    let html = '<table><thead><tr><th>時間</th><th>変更</th><th>受注番号</th><th>区分</th></tr></thead><tbody>';
    results.forEach(r => {
        html += `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[4]}</td></tr>`;
    });
    html += '</tbody></table>';
    popupResults.innerHTML = html;
}

closePopup.addEventListener('click', () => popupOverlay.classList.add('hidden'));

function startScanner(targetInput) {
    if (typeof ZXing === 'undefined') { alert('ライブラリ読込エラー'); return;
    }
    
    codeReader = new ZXing.BrowserMultiFormatReader();
    currentScannerTargetInput = targetInput;
    
    scannerPopup.classList.remove('hidden');
    
    const constraints = {
        video: {
            facingMode: "environment" 
        }
    };
    codeReader.decodeFromConstraints(constraints, 'scanner-video', (res, err) => {
        if (res) {
            const txt = res.getText();
            
            if (txt.includes('http') || txt.includes('google.com') || txt.includes('maps')) {
                console.log('Map/URL QR ignored:', txt);
                return; 
            }
            
            let code = '';
            let name = '';
            
            if (txt.includes(',')) {
                const parts = txt.split(',');
                if (parts[1] && parts[1].length === 15) {
                    code = parts[1];
                }
            } 
            
            if (!code) {
                const m = txt.match(/\d{15}/);
                if(m) code = m[0];
            }
            
            if (code) {
                currentScannerTargetInput.value = code;
                const set = currentScannerTargetInput.closest('.report-set');
                if(name) {
                    set.dataset.customerName = name;
                    set.querySelector('.customer-name-display').textContent = `(${name})`;
                }
                currentScannerTargetInput.blur();
                stopScanner();
            }
        }
    }).catch(err => {
        console.error(err);
        if (err.name === 'NotAllowedError' || err.message.includes('Permission denied')) {
            alert('カメラの許可がありません。\nブラウザの設定でカメラを「許可」にしてから、ページを再読み込みしてください。');
        } 
        else if (err.name === 'NotFoundError') 
        {
            alert('カメラが見つかりません。');
        } else {
            alert('カメラ起動エラー: ' + err.message);
        }
        stopScanner();
    });
}

function stopScanner() {
    if (codeReader) {
        codeReader.reset();
        codeReader = null;
    }
    scannerPopup.classList.add('hidden');
}
closeScannerButton.addEventListener('click', stopScanner);
window.onbeforeunload = (e) => {
    if(isFormDirty) {
        e.returnValue = '保存されていません';
        return '保存されていません';
    }
};