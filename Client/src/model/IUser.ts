//models/IUser.ts
export interface IUser{
    
    id: number,
    name: string,
    surname: string,
    mail: string,
    phone: string,
    institution: string,
    businessAdress: string,
    password: string,
    kvkkApproval: string,
    project: string,
    isAcctive: boolean
}