module.exports = {
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getContactsAsync: jest.fn().mockResolvedValue({ data: [] }),
  Fields: {
    PhoneNumbers: 'phoneNumbers',
    Name: 'name',
    FirstName: 'firstName',
    LastName: 'lastName',
  },
};
