function setControlsDisabled(disabled) {
  document.querySelectorAll('select, #download').forEach(function (control) {
    control.disabled = disabled;
  });
}

function formatDateTime() {
  return new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function formatAmount(amount) {
  return '₹' + amount.toLocaleString('en-IN');
}

function getTicketDate() {
  var now = new Date();
  var parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false
  }).formatToParts(now).reduce(function (result, part) {
    result[part.type] = part.value;
    return result;
  }, {});
  var date = new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day)
  ));
  if (Number(parts.hour) < 5) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return date.toISOString().slice(0, 10);
}

function getNextTicketNumber(counterKey) {
  var key = 'ssa-ticket-counter-v1-' + counterKey;
  var ticketDate = getTicketDate();
  var saved;
  try {
    saved = JSON.parse(localStorage.getItem(key) || 'null');
  } catch (error) {
    throw new Error('Ticket numbering storage is unavailable.');
  }
  var nextNumber = saved && saved.date === ticketDate ? saved.number + 1 : 1;
  try {
    localStorage.setItem(key, JSON.stringify({
      date: ticketDate,
      number: nextNumber
    }));
  } catch (error) {
    throw new Error('Ticket numbering storage is unavailable.');
  }
  return nextNumber;
}

function getSelections() {
  return Array.from(document.querySelectorAll('[data-price]')).map(function (row) {
    return {
      label: row.dataset.label,
      price: Number(row.dataset.price),
      seats: Number(row.querySelector('select').value)
    };
  }).filter(function (item) {
    return item.seats > 0;
  });
}

function updateSummary() {
  var selections = getSelections();
  var seats = selections.reduce(function (total, item) {
    return total + item.seats;
  }, 0);
  var amount = selections.reduce(function (total, item) {
    return total + item.price * item.seats;
  }, 0);
  document.getElementById('seat-total').textContent = seats;
  document.getElementById('amount-total').textContent = formatAmount(amount);
}

function drawReceipt(receipt, selections) {
  var image = new Image();
  image.onload = function () {
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    context.drawImage(image, 0, 0);

    var seatTotal = selections.reduce(function (total, item) {
      return total + item.seats;
    }, 0);
    var amountTotal = selections.reduce(function (total, item) {
      return total + item.price * item.seats;
    }, 0);
    var centerX = canvas.width / 2;
    var lineHeight = Math.round(canvas.width * 0.027);
    var fontSize = Math.round(canvas.width * 0.021);
    var y = Math.round(canvas.height * 0.46);

    context.fillStyle = receipt.showColor;
    context.font = 'bold ' + Math.round(canvas.width * 0.034) + 'px Georgia, serif';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillText((receipt.show + ' SHOW').toUpperCase(), canvas.width / 2, Math.round(canvas.height * 0.132));

    context.fillStyle = '#000';
    context.font = 'bold ' + Math.round(canvas.width * 0.032) + 'px Arial, sans-serif';
    context.textAlign = 'right';
    context.fillText('Ticket No: ' + receipt.ticketNumber, canvas.width - 46, 18);
    context.font = 'bold ' + fontSize + 'px Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText('Date & Time: ' + formatDateTime(), centerX, y);
    y += lineHeight * 1.4;

    selections.forEach(function (item) {
      var lineTotal = item.price * item.seats;
      context.fillText(
        item.label + ' x ' + item.seats + ' = ' + formatAmount(lineTotal),
        centerX,
        y
      );
      y += lineHeight;
    });

    y += Math.round(lineHeight * 0.35);
    context.fillText('Total Seats: ' + seatTotal, centerX, y);
    y += lineHeight;
    context.fillText('Total Amount: ' + formatAmount(amountTotal), centerX, y);

    canvas.toBlob(function (blob) {
      if (!blob) {
        setControlsDisabled(false);
        window.alert('The receipt could not be created.');
        return;
      }
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = receipt.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);
      setControlsDisabled(false);
    }, 'image/png');
  };
  image.onerror = function () {
    setControlsDisabled(false);
    window.alert('The receipt template could not be loaded.');
  };
  image.src = receipt.template;
}

document.addEventListener('DOMContentLoaded', function () {
  var config = window.RECEIPT_CONFIG;
  document.getElementById('template-name').textContent = config.templateName;

  config.tickets.forEach(function (ticket) {
    var row = document.createElement('div');
    row.className = 'ticket-row';
    row.dataset.label = ticket.label;
    row.dataset.price = ticket.price;
    row.innerHTML =
      '<div class="ticket-option">' + ticket.label + '</div>' +
      '<label class="seat-control"><span>Seats</span>' +
      '<select aria-label="Number of seats for ' + ticket.label + '">' +
      '<option value="0">0</option>' +
      '<option value="1">1</option>' +
      '<option value="2">2</option>' +
      '<option value="3">3</option>' +
      '<option value="4">4</option>' +
      '<option value="5">5</option>' +
      '<option value="6">6</option>' +
      '<option value="7">7</option>' +
      '<option value="8">8</option>' +
      '<option value="9">9</option>' +
      '</select></label>';
    row.querySelector('select').addEventListener('change', updateSummary);
    document.getElementById('tickets').appendChild(row);
  });

  document.querySelectorAll('input[name="show"]').forEach(function (input) {
    input.addEventListener('change', function () {
      config.show = input.value;
    });
  });

  document.getElementById('download').addEventListener('click', function () {
    var selections = getSelections();
    if (!selections.length) {
      window.alert('Please select at least one seat.');
      return;
    }
    setControlsDisabled(true);
    try {
      config.ticketNumber = getNextTicketNumber(config.counterKey);
      drawReceipt(config, selections);
    } catch (error) {
      setControlsDisabled(false);
      window.alert(error.message);
    }
  });
  updateSummary();
});
