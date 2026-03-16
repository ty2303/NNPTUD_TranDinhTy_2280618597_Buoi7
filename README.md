# NNPTUD-C2

Sinh vien thuc hien: Tran Dinh Ty

MSSV: 2280618597

Project ExpressJS + MongoDB cho bai tap mon Nen tang phat trien ung dung.

## Cac API reservations da bo sung

- `GET /api/v1/reservations/`: Lay tat ca reservation cua user dang dang nhap
- `GET /api/v1/reservations/:id`: Lay chi tiet 1 reservation cua user
- `POST /api/v1/reservations/reserveACart`: Tao reservation tu toan bo gio hang, co transaction
- `POST /api/v1/reservations/reserveItems`: Tao reservation tu danh sach san pham gui len, co transaction
- `POST /api/v1/reservations/cancelReserve/:id`: Huy reservation va tra so luong ve inventory

## Luu y

- Cac API reservations yeu cau dang nhap bang JWT hoac cookie token.
- Hai API `reserveACart` va `reserveItems` su dung transaction.
- API `cancelReserve/:id` khong su dung transaction theo yeu cau bai tap.
