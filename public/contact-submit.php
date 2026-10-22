<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed.']);
    exit;
}

$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody, true);

if (!is_array($data)) {
    $data = $_POST;
}

function clean_text($value) {
    return trim(strip_tags((string) ($value ?? '')));
}

$firstName = clean_text($data['firstName'] ?? '');
$lastName = clean_text($data['lastName'] ?? '');
$email = filter_var(clean_text($data['email'] ?? ''), FILTER_VALIDATE_EMAIL);
$phone = clean_text($data['phone'] ?? '');
$inquiryType = clean_text($data['inquiryType'] ?? 'Website inquiry');
$message = clean_text($data['message'] ?? '');

if ($firstName === '' || $lastName === '' || !$email || $message === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Please complete name, email, and message.']);
    exit;
}

$to = 'support@cwqv.com, digital@typhonmachinery.com';
$subject = 'New KONSTRUCTZ website message: ' . $inquiryType;
$submittedAt = gmdate('Y-m-d H:i:s') . ' UTC';

$body = implode("\n", [
    'New message from cwqv.com',
    '',
    'Name: ' . $firstName . ' ' . $lastName,
    'Email: ' . $email,
    'Phone: ' . ($phone !== '' ? $phone : 'Not provided'),
    'Inquiry type: ' . $inquiryType,
    'Submitted: ' . $submittedAt,
    '',
    'Message:',
    $message,
    '',
    'Reply directly to this email to contact the customer.'
]);

$headers = [
    'From: KONSTRUCTZ Website <support@cwqv.com>',
    'Reply-To: ' . $firstName . ' ' . $lastName . ' <' . $email . '>',
    'Content-Type: text/plain; charset=UTF-8'
];

$sent = mail($to, $subject, $body, implode("\r\n", $headers));

if (!$sent) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Mail server could not send the message.']);
    exit;
}

echo json_encode(['ok' => true]);
